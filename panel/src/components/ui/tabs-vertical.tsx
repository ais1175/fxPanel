import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

const TabsVertical = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Root
        ref={ref}
        orientation="vertical"
        className={cn(
            //TX CUSTOM: the enture root was just routed from radix
            'flex flex-row',
            className,
        )}
        {...props}
    />
));
TabsVertical.displayName = TabsPrimitive.Root.displayName;

const TabsVerticalList = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.List
        ref={ref}
        className={cn(
            'bg-muted text-muted-foreground inline-flex items-center justify-center rounded-md p-1',
            'h-max flex-col', //TX CUSTOM: removed h-10
            className,
        )}
        {...props}
    />
));
TabsVerticalList.displayName = TabsPrimitive.List.displayName;

const TabsVerticalTrigger = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
        ref={ref}
        className={cn(
            'ring-offset-background focus-visible:ring-ring data-[state=active]:bg-background data-[state=active]:text-foreground inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-xs',
            'w-full', //TX CUSTOM
            className,
        )}
        {...props}
    />
));
TabsVerticalTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsVerticalContent = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Content
        ref={ref}
        className={cn(
            'ring-offset-background focus-visible:ring-ring ml-2 w-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden',
            className,
        )}
        {...props}
    />
));
TabsVerticalContent.displayName = TabsPrimitive.Content.displayName;

export { TabsVertical, TabsVerticalList, TabsVerticalTrigger, TabsVerticalContent };
