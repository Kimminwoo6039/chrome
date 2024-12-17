"use client"
import React, {useEffect, useState} from 'react';
import {Card, CardContent, CardHeader} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Clock, Unlock} from 'lucide-react';
import {Input} from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {useForm} from "react-hook-form"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const EXTENSION_IDENTIFIER = 'URL_HISTORY_TRACKER_f7e8d9c6b5a4';

interface BlockedSite {
  url: string;
  blockedAt: Date;
  unblockTime?: Date;
  duration: number;
}

interface BlockSiteFormData {
  url: string;
  duration: number;
}

export default function BlockedSitesList() {
  const [blockedSites, setBlockedSites] = useState<BlockedSite[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<BlockSiteFormData>({
    defaultValues: {
      url: "",
      duration: 1
    }
  });

  const initDB = async (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('BlockedSitesDB', 1);

      request.onerror = () => {
        console.error("DB Error:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log("DB Opened successfully");
        resolve(request.result);
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        console.log("Upgrading database...");
        const db = (event.target as IDBOpenDBRequest).result;

        // 기존 스토어가 있다면 삭제
        if (db.objectStoreNames.contains('blockedSites')) {
          db.deleteObjectStore('blockedSites');
        }

        // 새 스토어 생성
        const store = db.createObjectStore('blockedSites', {
          keyPath: 'url',
          autoIncrement: false
        });

        // 인덱스 생성
        store.createIndex('blockedAt', 'blockedAt', {unique: false});
        store.createIndex('unblockTime', 'unblockTime', {unique: false});
        store.createIndex('duration', 'duration', {unique: false});

        console.log("Store created:", store);
      };
    });
  };


  const blockSite = async (url: string, duration: number) => {
    try {
      console.log("Blocking site:", url, "duration:", duration);

      // 확장프로그램에 메시지 전송
      window.postMessage({
        type: "block",
        source: "block",
        identifier: EXTENSION_IDENTIFIER,
        data: url,
        duration: duration
      }, "*");

      const db = await initDB();
      const transaction = db.transaction('blockedSites', 'readwrite');
      const store = transaction.objectStore('blockedSites');

      const blockedSite: BlockedSite = {
        url,
        blockedAt: new Date(),
        unblockTime: duration > 0 ? new Date(Date.now() + duration * 60 * 1000) : undefined,
        duration
      };

      return new Promise<void>((resolve, reject) => {
        const request = store.put(blockedSite);

        request.onerror = () => {
          console.error("Block error:", request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          console.log("Site blocked successfully:", blockedSite);
          loadBlockedSites();
          resolve();
        };
      });
    } catch (error) {
      console.error('Error blocking site:', error);
    }
  };

  const unblockSite = async (url: string) => {
    try {
      window.postMessage({
        type: "unblock",
        source: "unblock",
        identifier: EXTENSION_IDENTIFIER,
        data: url
      }, "*");

      const db = await initDB();
      const transaction = db.transaction('blockedSites', 'readwrite');
      const store = transaction.objectStore('blockedSites');
      await store.delete(url);
      loadBlockedSites();
    } catch (error) {
      console.error('Error unblocking site:', error);
    }
  };

  const loadBlockedSites = async () => {
    try {
      console.log("Loading blocked sites...");
      const db = await initDB();
      const transaction = db.transaction('blockedSites', 'readonly');
      const store = transaction.objectStore('blockedSites');

      return new Promise<void>((resolve, reject) => {
        const request = store.getAll();

        request.onerror = () => {
          console.error("Load error:", request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          console.log("Raw data loaded:", request.result);
          const sites = request.result.map(site => ({
            ...site,
            blockedAt: new Date(site.blockedAt),
            unblockTime: site.unblockTime ? new Date(site.unblockTime) : undefined
          }));
          console.log("Processed sites:", sites);
          setBlockedSites(sites);
          resolve();
        };
      });
    } catch (error) {
      console.error('Error loading blocked sites:', error);
    }
  };

  const truncateUrl = (url: string) => {
    if (url.length > 100) {
      return url.substring(0, 100) + '...';
    }
    return url;
  };

  const onSubmit = async (data: BlockSiteFormData) => {
    await blockSite(data.url, data.duration);
    setIsDialogOpen(false);
    form.reset();
  };

  useEffect(() => {
    console.log("Component mounted");
    loadBlockedSites();

    // 10초마다 만료된 차단 확인 및 삭제
    const checkExpiredSites = async () => {
      try {
        const db = await initDB();
        const transaction = db.transaction('blockedSites', 'readwrite');
        const store = transaction.objectStore('blockedSites');
        const request = store.getAll();

        request.onsuccess = () => {
          const currentTime = new Date();
          const sites = request.result;

          sites.forEach(async (site) => {
            if (site.unblockTime && new Date(site.unblockTime) <= currentTime) {
              console.log('Expired site found:', site.url);
              // DB에서 삭제
              await store.delete(site.url);
              // 차단 해제 메시지 전송
              window.postMessage({
                type: "unblock",
                source: "unblock",
                identifier: EXTENSION_IDENTIFIER,
                data: site.url
              }, "*");
            }
          });
        };
      } catch (error) {
        console.error('Error checking expired sites:', error);
      }
    };

    // 10초마다 실행되는 인터벌
    const interval = setInterval(() => {
      console.log("Checking expired sites...");
      checkExpiredSites();
      loadBlockedSites(); // 목록 새로고침
    }, 3000);

    return () => {
      console.log("Cleaning up interval");
      clearInterval(interval);
    };
  }, []);

  return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">차단된 사이트 관리</h2>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>사이트 차단</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>새 사이트 차단</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="url"
                        render={({field}) => (
                            <FormItem>
                              <FormLabel>URL</FormLabel>
                              <FormControl>
                                <Input placeholder="example.com" {...field} />
                              </FormControl>
                              <FormMessage/>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="duration"
                        render={({field}) => (
                            <FormItem>
                              <FormLabel>차단 시간 (분)</FormLabel>
                              <FormControl>
                                <Input type="number" {...field}
                                       onChange={e => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage/>
                            </FormItem>
                        )}
                    />
                    <Button type="submit">차단하기</Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {blockedSites.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    차단된 사이트가 없습니다
                  </div>
              ) : (
                  blockedSites.map((site) => (
                      <div key={site.url}
                           className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{truncateUrl(site.url)}</p>
                          <div className="flex items-center text-sm text-muted-foreground mt-1">
                            <Clock className="w-4 h-4 mr-1"/>
                            차단 시간: {site.blockedAt.toLocaleString()}
                            {site.unblockTime && (
                                <span className="ml-2">
                         (해제 예정: {site.unblockTime.toLocaleString()})
                       </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => unblockSite(site.url)}
                          >
                            <Unlock className="w-4 h-4"/>
                          </Button>
                        </div>
                      </div>
                  ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
  );
}