import * as React from "react";
import { Bell, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="bg-white shadow-sm">
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center">
          <h1 className="text-2xl font-semibold text-neutral-800">{title}</h1>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100">
            <Bell className="w-6 h-6" />
          </Button>
          <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100">
            <Settings className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </header>
  );
}
