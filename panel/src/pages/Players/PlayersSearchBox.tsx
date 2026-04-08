import { throttle } from 'throttle-debounce';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronsUpDownIcon, FilterXIcon, XIcon, ChevronDownIcon, ExternalLinkIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlayersTableFiltersType, PlayersTableSearchType } from '@shared/playerApiTypes';
import { Link } from 'wouter';

/**
 * Helpers
 */
export const availableSearchTypes = [
    {
        value: 'playerName',
        label: 'Name',
        placeholder: 'Enter a player name',
        description: 'Search players by their last display name.',
    },
    {
        value: 'playerNotes',
        label: 'Notes',
        placeholder: 'Enter part of the note to search for',
        description: 'Search players by their profile notes contents.',
    },
    {
        value: 'playerIds',
        label: 'Player IDs',
        placeholder: 'License, Discord, Steam, etc.',
        description: 'Search players by their IDs separated by a comma.',
    },
] as const;

export const availableFilters = [
    { label: 'Is Admin', value: 'isAdmin' },
    { label: 'Is Online', value: 'isOnline' },
    { label: 'Is Banned', value: 'isBanned' },
    { label: 'Has Previous Ban', value: 'hasPreviousBan' },
    { label: 'Has Whitelisted ID', value: 'isWhitelisted' },
    { label: 'Has Profile Notes', value: 'hasNote' },
] as const;

//FIXME: this doesn't require exporting, but HMR doesn't work without it
// eslint-disable-next-line react-refresh/only-export-components
export const throttleFunc = throttle(
    1250,
    (func: any) => {
        func();
    },
    { noLeading: true },
);

/**
 * Component
 */
export type PlayersSearchBoxReturnStateType = {
    search: PlayersTableSearchType;
    filters: PlayersTableFiltersType;
};

type PlayerSearchBoxProps = {
    doSearch: (search: PlayersTableSearchType, filters: PlayersTableFiltersType, rememberSearchType: boolean) => void;
    initialState: PlayersSearchBoxReturnStateType & { rememberSearchType: boolean };
};

export function PlayerSearchBox({ doSearch, initialState }: PlayerSearchBoxProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isSearchTypeDropdownOpen, setSearchTypeDropdownOpen] = useState(false);
    const [isFilterDropdownOpen, setFilterDropdownOpen] = useState(false);
    const [currSearchType, setCurrSearchType] = useState<string>(initialState.search.type);
    const [selectedFilters, setSelectedFilters] = useState<string[]>(initialState.filters);
    const [hasSearchText, setHasSearchText] = useState(!!initialState.search.value);
    const [rememberSearchType, setRememberSearchType] = useState(initialState.rememberSearchType);

    const updateSearch = () => {
        if (!inputRef.current) return;
        const searchValue = inputRef.current.value.trim();
        doSearch({ value: searchValue, type: currSearchType }, selectedFilters, rememberSearchType);
    };

    //Call onSearch when params change
    useEffect(() => {
        updateSearch();
    }, [currSearchType, selectedFilters]);

    //Input handlers
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            throttleFunc.cancel({ upcomingOnly: true });
            updateSearch();
        } else if (e.key === 'Escape') {
            inputRef.current!.value = '';
            throttleFunc(updateSearch);
            setHasSearchText(false);
        } else {
            throttleFunc(updateSearch);
            setHasSearchText(true);
        }
    };

    const clearSearchBtn = () => {
        inputRef.current!.value = '';
        throttleFunc.cancel({ upcomingOnly: true });
        updateSearch();
        setHasSearchText(false);
    };

    const filterSelectChange = (filter: string, checked: boolean) => {
        if (checked) {
            setSelectedFilters((prev) => [...prev, filter]);
        } else {
            setSelectedFilters((prev) => prev.filter((f) => f !== filter));
        }
    };

    //It's render time! 🎉
    const selectedSearchType = availableSearchTypes.find((type) => type.value === currSearchType);
    if (!selectedSearchType) throw new Error(`Invalid search type: ${currSearchType}`);
    const filterBtnMessage = selectedFilters.length
        ? `${selectedFilters.length} Filter${selectedFilters.length > 1 ? 's' : ''}`
        : 'No filters';
    return (
        <div className="border-border bg-card text-card-foreground mb-2 border p-4 shadow-xs md:mb-4 md:rounded-xl">
            <div className="flex flex-wrap-reverse gap-2">
                <div className="relative min-w-44 grow">
                    <Input
                        type="text"
                        autoFocus
                        autoCapitalize="off"
                        autoCorrect="off"
                        ref={inputRef}
                        placeholder={selectedSearchType.placeholder}
                        defaultValue={initialState.search.value}
                        onKeyDown={handleInputKeyDown}
                    />
                    {hasSearchText && (
                        <button
                            className="ring-offset-background focus-visible:ring-ring absolute inset-y-0 right-2 rounded-lg text-zinc-400 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
                            onClick={clearSearchBtn}
                        >
                            <XIcon />
                        </button>
                    )}
                </div>

                <div className="flex grow flex-wrap content-start gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={isSearchTypeDropdownOpen}
                                onClick={() => setSearchTypeDropdownOpen(!isSearchTypeDropdownOpen)}
                                className="xs:w-48 border-input hover:bg-primary grow justify-between bg-black/30 md:grow-0"
                            >
                                Search by {selectedSearchType.label}
                                <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48">
                            <DropdownMenuLabel>Search Type</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuRadioGroup value={currSearchType} onValueChange={setCurrSearchType}>
                                {availableSearchTypes.map((searchType) => (
                                    <DropdownMenuRadioItem
                                        key={searchType.value}
                                        value={searchType.value}
                                        className="cursor-pointer"
                                    >
                                        {searchType.label}
                                    </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuRadioGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem
                                checked={rememberSearchType}
                                className="cursor-pointer"
                                onCheckedChange={setRememberSearchType}
                            >
                                Remember Option
                            </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={isFilterDropdownOpen}
                                onClick={() => setFilterDropdownOpen(!isFilterDropdownOpen)}
                                className="xs:w-44 border-input hover:bg-primary grow justify-between bg-black/30 md:grow-0"
                            >
                                {filterBtnMessage}
                                <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-44">
                            <DropdownMenuLabel>Search Filters</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {availableFilters.map((filter) => (
                                <DropdownMenuCheckboxItem
                                    key={filter.value}
                                    checked={selectedFilters.includes(filter.value)}
                                    className="cursor-pointer"
                                    onCheckedChange={(checked) => {
                                        filterSelectChange(filter.value, checked);
                                    }}
                                >
                                    {filter.label}
                                </DropdownMenuCheckboxItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="cursor-pointer" onClick={() => setSelectedFilters([])}>
                                <FilterXIcon className="mr-2 h-4 w-4" />
                                Clear Filters
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="flex grow justify-end">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="grow md:grow-0">
                                    More
                                    <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem className="h-10 py-2 pr-2 pl-1" asChild>
                                    <Link href="/ban-identifiers" className="cursor-pointer">
                                        <ExternalLinkIcon className="mr-1 inline h-4" />
                                        Ban Identifiers
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="h-10 py-2 pr-2 pl-1" asChild>
                                    <Link href="/system/master-actions#cleandb" className="cursor-pointer">
                                        <ExternalLinkIcon className="mr-1 inline h-4" />
                                        Prune Players/HWIDs
                                    </Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
            <div className="text-muted-foreground mt-1 px-1 text-xs">{selectedSearchType.description}</div>
        </div>
    );
}
