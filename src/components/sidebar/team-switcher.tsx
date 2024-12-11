"use client"

import * as React from "react"
import {SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,} from "@/components/ui/sidebar"
import Link from "next/link";

export function TeamSwitcher({
                               teams,
                             }: {
  teams: {
    name: string
    logo: string
    plan: string
  }[]
}) {
  const {isMobile} = useSidebar()
  const [activeTeam, setActiveTeam] = React.useState(teams[0])

  return (
      <SidebarMenu>
        <SidebarMenuItem>
          <Link href="/">

            <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div
                  className="flex aspect-square size-8 items-center justify-center rounded-lg  text-sidebar-primary-foreground">
                <img
                    src={activeTeam.logo}
                />
              </div>
              <div className="grid flex-1 text-left text-lg leading-tight">
                <span className="truncate font-semibold">
                  {activeTeam.name}
                </span>
                <span className="truncate text-xs">{activeTeam.plan}</span>
              </div>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      </SidebarMenu>
  )
}
