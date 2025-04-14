"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { ThemeToggle } from "./theme-toggle";

export function DarkThemeShowcase() {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  return (
    <div className="container mx-auto py-6">
      <Card className="w-full mb-6">
        <CardHeader>
          <CardTitle className="gradient-text">Dark Theme Showcase</CardTitle>
          <CardDescription>
            Demonstrating the beautiful dark theme UI components
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">UI Components</h3>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button variant="default">Default Button</Button>
                  <Button variant="outline">Outline Button</Button>
                  <Button variant="ghost">Ghost Button</Button>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="tool-badge bg-blue-500/10 text-blue-500 border-blue-500/20">Weather</span>
                  <span className="tool-badge bg-green-500/10 text-green-500 border-green-500/20">Calculator</span>
                  <span className="tool-badge bg-purple-500/10 text-purple-500 border-purple-500/20">Finance</span>
                </div>
                
                <div className="p-4 border rounded-lg bg-card">
                  <p className="text-sm text-muted-foreground">Card with muted text</p>
                  <p className="font-medium mt-1">Regular text on card background</p>
                </div>

                {/* Daisy UI Components */}
                <div className="p-4 border rounded-lg">
                  <h4 className="text-sm font-medium mb-2">Daisy UI Components</h4>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-primary">Daisy Button</button>
                    <button className="btn btn-secondary">Secondary</button>
                    <button className="btn btn-accent">Accent</button>
                    <button className="btn btn-ghost">Ghost</button>
                  </div>
                  <div className="divider">Divider</div>
                  <div className="flex gap-2 mt-2">
                    <div className="badge">Badge</div>
                    <div className="badge badge-primary">Primary</div>
                    <div className="badge badge-secondary">Secondary</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Theme Controls</h3>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span>Toggle Theme:</span>
                  <ThemeToggle />
                </div>
                
                <div className="text-sm text-muted-foreground">
                  Current time: {currentTime.toLocaleTimeString()}
                </div>
              </div>
              
              <div className="p-4 border rounded-lg">
                <div className="text-sm mb-2">Typing indicator:</div>
                <div className="typing-indicator">
                  <div className="typing-indicator-dot"></div>
                  <div className="typing-indicator-dot"></div>
                  <div className="typing-indicator-dot"></div>
                </div>
              </div>
              
              <div className="p-4 border rounded-lg bg-primary/5">
                <div className="text-sm mb-2">Gradient text:</div>
                <h2 className="text-xl font-bold gradient-text">MC-TO-THE-P</h2>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            Using React, ShadCN, DaisyUI, and Tailwind CSS for a beautiful dark-themed UI
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
