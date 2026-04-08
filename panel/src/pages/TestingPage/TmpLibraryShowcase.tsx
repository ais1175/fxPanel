import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import SwitchText from '@/components/SwitchText';
import InlineCode from '@/components/InlineCode';
import TxAnchor from '@/components/TxAnchor';
import DateTimeCorrected from '@/components/DateTimeCorrected';
import { PersonStandingIcon, AlertTriangleIcon, InfoIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react';

export default function TmpLibraryShowcase() {
    return (
        <div className="mx-4 space-y-12 pb-8">
            {/* Header */}
            <div className="space-y-2 text-center">
                <h1 className="text-4xl font-bold">UI Library Showcase</h1>
                <p className="text-muted-foreground">
                    A <i>not at all</i> comprehensive overview of some UI components
                </p>
            </div>

            {/* Buttons Section */}
            <section className="space-y-6">
                <h2 className="border-b pb-2 text-2xl font-semibold">Buttons</h2>

                {/* Button Variants */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Variants</h3>
                    <div className="flex flex-wrap gap-3">
                        <Button variant="default">Default</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="muted">Muted</Button>
                        <Button variant="destructive">Destructive</Button>
                        <Button variant="warning">Warning</Button>
                        <Button variant="success">Success</Button>
                        <Button variant="info">Info</Button>
                        <Button variant="outline">Outline</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="link">Link</Button>
                    </div>
                </div>

                {/* Button Sizes */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Sizes</h3>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button size="icon">
                            <PersonStandingIcon />
                        </Button>
                        <Button size="inline">Inline</Button>
                        <Button size="xs">Extra Small</Button>
                        <Button size="sm">Small</Button>
                        <Button size="default">Default</Button>
                        <Button size="lg">Large</Button>
                    </div>
                    <p className="text-muted-foreground text-sm">
                        <InlineCode>inline</InlineCode> is custom - useful for inline text buttons like "click{' '}
                        <Button size="inline" variant="link">
                            here
                        </Button>{' '}
                        to continue".
                    </p>
                </div>

                {/* Ghost Variants */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Ghost Variants</h3>
                    <div className="flex flex-wrap gap-3">
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="ghost-secondary">Ghost Secondary</Button>
                        <Button variant="ghost-destructive">Ghost Destructive</Button>
                        <Button variant="ghost-warning">Ghost Warning</Button>
                        <Button variant="ghost-success">Ghost Success</Button>
                        <Button variant="ghost-info">Ghost Info</Button>
                        <Button variant="ghost-muted">Ghost Muted</Button>
                    </div>
                </div>

                {/* Outline Variants */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Outline Variants</h3>
                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline">Outline</Button>
                        <Button variant="outline-secondary">Outline Secondary</Button>
                        <Button variant="outline-destructive">Outline Destructive</Button>
                        <Button variant="outline-warning">Outline Warning</Button>
                        <Button variant="outline-success">Outline Success</Button>
                        <Button variant="outline-info">Outline Info</Button>
                        <Button variant="outline-muted">Outline Muted</Button>
                    </div>
                </div>

                {/* Button States */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">States</h3>
                    <div className="flex flex-wrap gap-3">
                        <Button>Normal</Button>
                        <Button disabled>Disabled</Button>
                        <Button>
                            <PersonStandingIcon className="mr-2 h-4 w-4" />
                            With Icon
                        </Button>
                    </div>
                </div>
            </section>

            {/* Form Inputs Section */}
            <section className="space-y-6">
                <h2 className="border-b pb-2 text-2xl font-semibold">Form Inputs</h2>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Text Inputs */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Text Inputs</h3>
                        <div className="space-y-3">
                            <Input placeholder="Default input" />
                            <Input placeholder="Email input" type="email" />
                            <Input placeholder="Password input" type="password" />
                            <Input placeholder="Disabled input" disabled />
                            <Input placeholder="Input with value" defaultValue="Sample text" />
                        </div>
                    </div>

                    {/* Textarea */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Textarea</h3>
                        <div className="space-y-3">
                            <Textarea placeholder="Default textarea" />
                            <Textarea placeholder="Disabled textarea" disabled />
                            <Textarea
                                placeholder="Textarea with content"
                                defaultValue="This is some sample content in the textarea component."
                            />
                        </div>
                    </div>
                </div>

                {/* Checkboxes and Switches */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Checkboxes</h3>
                        <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="checkbox1" />
                                <label htmlFor="checkbox1" className="text-sm font-medium">
                                    Default checkbox
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="checkbox2" defaultChecked />
                                <label htmlFor="checkbox2" className="text-sm font-medium">
                                    Checked checkbox
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="checkbox3" disabled />
                                <label htmlFor="checkbox3" className="text-muted-foreground text-sm font-medium">
                                    Disabled checkbox
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Switches</h3>
                        <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                                <Switch id="switch1" />
                                <label htmlFor="switch1" className="text-sm font-medium">
                                    Default switch
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch id="switch2" defaultChecked />
                                <label htmlFor="switch2" className="text-sm font-medium">
                                    Checked switch
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch id="switch3" disabled />
                                <label htmlFor="switch3" className="text-muted-foreground text-sm font-medium">
                                    Disabled switch
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Badges Section */}
            <section className="space-y-6">
                <h2 className="border-b pb-2 text-2xl font-semibold">Badges</h2>

                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Badge Variants</h3>
                    <div className="flex flex-wrap gap-3">
                        <Badge variant="default">Default</Badge>
                        <Badge variant="secondary">Secondary</Badge>
                        <Badge variant="destructive">Destructive</Badge>
                        <Badge variant="outline">Outline</Badge>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Usage Examples</h3>
                    <div className="flex flex-wrap gap-3">
                        <Badge>New</Badge>
                        <Badge variant="destructive">Error</Badge>
                        <Badge variant="secondary">Beta</Badge>
                        <Badge variant="outline">Coming Soon</Badge>
                        <Badge>v2.1.0</Badge>
                        <Badge variant="secondary">Online</Badge>
                    </div>
                </div>
            </section>

            {/* Alerts Section */}
            <section className="space-y-6">
                <h2 className="border-b pb-2 text-2xl font-semibold">Alerts</h2>

                <div className="space-y-4">
                    <Alert variant="default">
                        <InfoIcon className="h-4 w-4" />
                        <AlertTitle>Default Alert</AlertTitle>
                        <AlertDescription>This is a default alert with some information for the user.</AlertDescription>
                    </Alert>

                    <Alert variant="info">
                        <InfoIcon className="h-4 w-4" />
                        <AlertTitle>Information</AlertTitle>
                        <AlertDescription>
                            This is an informational alert that provides helpful context.
                        </AlertDescription>
                    </Alert>

                    <Alert variant="success">
                        <CheckCircleIcon className="h-4 w-4" />
                        <AlertTitle>Success</AlertTitle>
                        <AlertDescription>Your action was completed successfully!</AlertDescription>
                    </Alert>

                    <Alert variant="warning">
                        <AlertTriangleIcon className="h-4 w-4" />
                        <AlertTitle>Warning</AlertTitle>
                        <AlertDescription>Please review this information carefully before proceeding.</AlertDescription>
                    </Alert>

                    <Alert variant="destructive">
                        <XCircleIcon className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>
                            An error occurred while processing your request. Please try again.
                        </AlertDescription>
                    </Alert>
                </div>
            </section>

            {/* SwitchText Section */}
            <section className="space-y-6">
                <h2 className="border-b pb-2 text-2xl font-semibold">
                    SwitchText <Badge variant="outline">Custom</Badge>
                </h2>
                <p className="text-muted-foreground text-sm">
                    A custom Switch component that shows different labels based on state, with semantic color variants.
                </p>

                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Color Variants</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-2">
                            <SwitchText checkedLabel="Default On" uncheckedLabel="Default Off" defaultChecked />
                            <p className="text-muted-foreground text-xs">variant="default"</p>
                        </div>
                        <div className="space-y-2">
                            <SwitchText
                                variant="checkedGreen"
                                checkedLabel="Enabled"
                                uncheckedLabel="Disabled"
                                defaultChecked
                            />
                            <p className="text-muted-foreground text-xs">variant="checkedGreen"</p>
                        </div>
                        <div className="space-y-2">
                            <SwitchText
                                variant="checkedYellow"
                                checkedLabel="Warning On"
                                uncheckedLabel="Warning Off"
                                defaultChecked
                            />
                            <p className="text-muted-foreground text-xs">variant="checkedYellow"</p>
                        </div>
                        <div className="space-y-2">
                            <SwitchText
                                variant="checkedRed"
                                checkedLabel="Danger On"
                                uncheckedLabel="Danger Off"
                                defaultChecked
                            />
                            <p className="text-muted-foreground text-xs">variant="checkedRed"</p>
                        </div>
                        <div className="space-y-2">
                            <SwitchText variant="uncheckedGreen" checkedLabel="Off" uncheckedLabel="Safe" />
                            <p className="text-muted-foreground text-xs">variant="uncheckedGreen"</p>
                        </div>
                        <div className="space-y-2">
                            <SwitchText variant="uncheckedYellow" checkedLabel="Off" uncheckedLabel="Warning" />
                            <p className="text-muted-foreground text-xs">variant="uncheckedYellow"</p>
                        </div>
                        <div className="space-y-2">
                            <SwitchText variant="uncheckedRed" checkedLabel="Off" uncheckedLabel="Danger" />
                            <p className="text-muted-foreground text-xs">variant="uncheckedRed"</p>
                        </div>
                        <div className="space-y-2">
                            <SwitchText
                                variant="redGreen"
                                checkedLabel="Enabled"
                                uncheckedLabel="Disabled"
                                defaultChecked
                            />
                            <p className="text-muted-foreground text-xs">variant="redGreen"</p>
                        </div>
                        <div className="space-y-2">
                            <SwitchText variant="greenRed" checkedLabel="Danger!" uncheckedLabel="Safe" />
                            <p className="text-muted-foreground text-xs">variant="greenRed"</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* InlineCode & TxAnchor Section */}
            <section className="space-y-6">
                <h2 className="border-b pb-2 text-2xl font-semibold">
                    Text Components <Badge variant="outline">Custom</Badge>
                </h2>

                <div className="space-y-4">
                    <h3 className="text-lg font-medium">InlineCode</h3>
                    <p className="text-sm">
                        Use <InlineCode>InlineCode</InlineCode> for inline code snippets like{' '}
                        <InlineCode>npm install</InlineCode> or variable names like <InlineCode>myVariable</InlineCode>.
                    </p>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-medium">TxAnchor</h3>
                    <p className="text-sm">
                        Smart anchor component that handles internal navigation and external links properly. External
                        links open in a new tab with an icon:{' '}
                        <TxAnchor href="https://github.com/tabarra/txAdmin">txAdmin GitHub</TxAnchor>
                    </p>
                    <p className="text-sm">
                        Internal links use wouter navigation: <TxAnchor href="/players">Players Page</TxAnchor>
                    </p>
                </div>
            </section>

            {/* DateTimeCorrected Section */}
            <section className="space-y-6">
                <h2 className="border-b pb-2 text-2xl font-semibold">
                    DateTimeCorrected <Badge variant="outline">Custom</Badge>
                </h2>
                <p className="text-muted-foreground text-sm">
                    Displays timestamps corrected for server/client clock drift. Hover for full date/time.
                </p>

                <div className="space-y-4">
                    <div className="flex flex-wrap gap-6">
                        <div className="space-y-1">
                            <p className="text-muted-foreground text-xs">Date + Time (default)</p>
                            <DateTimeCorrected
                                tsFetch={Date.now()}
                                tsObject={Date.now() - 3600000}
                                serverTime={Date.now()}
                            />
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground text-xs">Date only</p>
                            <DateTimeCorrected
                                tsFetch={Date.now()}
                                tsObject={Date.now() - 86400000 * 3}
                                serverTime={Date.now()}
                                isDateOnly
                            />
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground text-xs">With clock drift warning</p>
                            <DateTimeCorrected
                                tsFetch={Date.now()}
                                tsObject={Date.now() - 3600000}
                                serverTime={Date.now() + 600000}
                            />
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
