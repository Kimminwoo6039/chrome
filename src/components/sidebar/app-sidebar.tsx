"use client"

import * as React from "react"
import {BookOpen, Bot, SquareTerminal,} from "lucide-react"

import {NavUser} from "@/components/sidebar/nav-user"
import {TeamSwitcher} from "@/components/sidebar/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import {NavMain} from "@/components/sidebar/nav-main";

// This is sample data.
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "meerCat.ch",
      logo: "/meer.ico",
      plan: "",
    },
  ],
  navMain: [
    {
      title: "홈",
      url: "#",
      icon: SquareTerminal,
      isActive: true,
      items: [
        {
          title: "대시보드",
          url: "/",
        },
      ],
    },
    {
      title: "이미지",
      url: "#",
      icon: Bot,
      isActive: true,
      items: [
        {
          title: "선정성 이미지",
          url: "/image/detection",
        },
        {
          title: "도박성 이미지",
          url: "/image/gambling",
        },
      ],
    },
    {
      title: "도박",
      url: "#",
      icon: BookOpen,
      isActive: true,
      items: [
        {
          title: "도박 검출",
          url: "/gambling",
        },
      ],
    },
    {
      title: "차단",
      url: "#",
      icon: BookOpen,
      isActive: true,
      items: [
        {
          title: "사이트 차단",
          url: "/block",
        },
      ],
    },
  ],
}

export function AppSidebar({...props}: React.ComponentProps<typeof Sidebar>) {
  return (
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <TeamSwitcher teams={data.teams}/>
        </SidebarHeader>
        <SidebarContent>
          <NavMain items={data.navMain}/>
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={data.user}/>
        </SidebarFooter>
        <SidebarRail/>
      </Sidebar>
  )
}
