-- Prevent running if menu is disabled
if not TX_MENU_ENABLED then
    return
end

-- =============================================
--  This file contains all overhead player ID logic
-- =============================================

-- Variables
local isPlayerIdsEnabled = false
local playerGamerTags = {}
local distanceToCheck = GetConvarInt('txAdmin-menuPlayerIdDistance', 150)

-- Game consts
local fivemGamerTagCompsEnum = {
    GamerName = 0,
    CrewTag = 1,
    HealthArmour = 2,
    BigText = 3,
    AudioIcon = 4,
    UsingMenu = 5,
    PassiveMode = 6,
    WantedStars = 7,
    Driver = 8,
    CoDriver = 9,
    Tagged = 12,
    GamerNameNearby = 13,
    Arrow = 14,
    Packages = 15,
    InvIfPedIsFollowing = 16,
    RankText = 17,
    Typing = 18,
}

local redmGamerTagCompsEnum = {
    none = 0,
    icon = 1,
    simple = 2,
    complex = 3,
}
local redmSpeakerIconHash = GetHashKey('SPEAKER')
local redmColorYellowHash = GetHashKey('COLOR_YELLOWSTRONG')

-- Tag display config: label prefix and HUD color index (FiveM)
-- See https://docs.fivem.net/docs/game-references/hud-colors/ for color indices
-- Auto-tag HUD color overrides (FiveM only supports palette indices, not hex)
local autoTagHudColors = {
    staff = 6,        -- HUD_COLOUR_RED
    problematic = 17, -- HUD_COLOUR_ORANGE
    newplayer = 12,   -- HUD_COLOUR_YELLOW (green-ish)
}
local defaultCustomHudColor = 4 -- HUD_COLOUR_BLUE for custom tags

--- Builds the tag display config and priority list from TX_SERVER_CTX.tagDefinitions
local tagDisplayConfig = {}
local tagPriority = {}

local function rebuildTagConfig()
    local defs = TX_SERVER_CTX and TX_SERVER_CTX.tagDefinitions or {}
    local newConfig = {}
    local newPriority = {}

    if #defs > 0 then
        -- Sort a copy by priority (lower = higher priority), excluding disabled tags
        local sorted = {}
        for _, d in ipairs(defs) do
            if d.enabled ~= false then
                sorted[#sorted + 1] = d
            end
        end
        table.sort(sorted, function(a, b) return a.priority < b.priority end)

        for _, d in ipairs(sorted) do
            local prefix = '[' .. string.upper(string.sub(d.label, 1, 1)) .. '] '
            local hudColor = autoTagHudColors[d.id] or defaultCustomHudColor
            newConfig[d.id] = { prefix = prefix, hudColor = hudColor }
            newPriority[#newPriority + 1] = d.id
        end
    else
        -- Fallback to hardcoded auto-tags
        newConfig = {
            staff = { prefix = '[S] ', hudColor = 6 },
            problematic = { prefix = '[!] ', hudColor = 17 },
            newplayer = { prefix = '[N] ', hudColor = 12 },
        }
        newPriority = { 'staff', 'problematic', 'newplayer' }
    end

    tagDisplayConfig = newConfig
    tagPriority = newPriority
end
rebuildTagConfig()

--- Gets the highest-priority tag for a player from TX_LOCAL_PLAYERLIST
local function getPlayerTopTag(serverId)
    local pidStr = tostring(serverId)
    if TX_LOCAL_PLAYERLIST[pidStr] == nil then return nil end
    local tags = TX_LOCAL_PLAYERLIST[pidStr].tags
    if tags == nil then return nil end
    local tagSet = {}
    for _, t in ipairs(tags) do
        tagSet[t] = true
    end
    for _, t in ipairs(tagPriority) do
        if tagSet[t] then return t end
    end
    return nil
end

--- Removes all cached tags
local function cleanAllGamerTags()
    DebugPrint('Cleaning up gamer tags table')
    for _, v in pairs(playerGamerTags) do
        if IsMpGamerTagActive(v.gamerTag) then
            if IS_FIVEM then
                RemoveMpGamerTag(v.gamerTag)
            else
                Citizen.InvokeNative(0x839BFD7D7E49FE09, Citizen.PointerValueIntInitialized(v.gamerTag))
            end
        end
    end
    playerGamerTags = {}
end

--- Draws a single gamer tag (fivem)
local function setGamerTagFivem(targetTag, pid)
    -- Setup name
    ---@diagnostic disable-next-line: param-type-mismatch
    SetMpGamerTagVisibility(targetTag, fivemGamerTagCompsEnum.GamerName, 1)

    -- Setup Health
    SetMpGamerTagHealthBarColor(targetTag, 129)
    SetMpGamerTagAlpha(targetTag, fivemGamerTagCompsEnum.HealthArmour, 255)
    ---@diagnostic disable-next-line: param-type-mismatch
    SetMpGamerTagVisibility(targetTag, fivemGamerTagCompsEnum.HealthArmour, 1)

    -- Determine name color based on tag or talking state
    local serverId = GetPlayerServerId(pid)
    local topTag = getPlayerTopTag(serverId)
    local tagHudColor = topTag and tagDisplayConfig[topTag] and tagDisplayConfig[topTag].hudColor or nil

    -- Setup AudioIcon
    SetMpGamerTagAlpha(targetTag, fivemGamerTagCompsEnum.AudioIcon, 255)
    if NetworkIsPlayerTalking(pid) then
        SetMpGamerTagVisibility(targetTag, fivemGamerTagCompsEnum.AudioIcon, true)
        SetMpGamerTagColour(targetTag, fivemGamerTagCompsEnum.AudioIcon, 12) --HUD_COLOUR_YELLOW
        SetMpGamerTagColour(targetTag, fivemGamerTagCompsEnum.GamerName, 12) --HUD_COLOUR_YELLOW
    else
        SetMpGamerTagVisibility(targetTag, fivemGamerTagCompsEnum.AudioIcon, false)
        SetMpGamerTagColour(targetTag, fivemGamerTagCompsEnum.AudioIcon, 0)
        SetMpGamerTagColour(targetTag, fivemGamerTagCompsEnum.GamerName, tagHudColor or 0)
    end
end

--- Clears a single gamer tag (fivem)
local function clearGamerTagFivem(targetTag)
    -- Cleanup name
    ---@diagnostic disable-next-line: param-type-mismatch
    SetMpGamerTagVisibility(targetTag, fivemGamerTagCompsEnum.GamerName, 0)
    -- Cleanup Health
    ---@diagnostic disable-next-line: param-type-mismatch
    SetMpGamerTagVisibility(targetTag, fivemGamerTagCompsEnum.HealthArmour, 0)
    -- Cleanup AudioIcon
    ---@diagnostic disable-next-line: param-type-mismatch
    SetMpGamerTagVisibility(targetTag, fivemGamerTagCompsEnum.AudioIcon, 0)
end

--- Draws a single gamer tag (redm)
local function setGamerTagRedm(targetTag, pid)
    Citizen.InvokeNative(0x93171DDDAB274EB8, targetTag, redmGamerTagCompsEnum.complex) --SetMpGamerTagVisibility
    if MumbleIsPlayerTalking(pid) then
        Citizen.InvokeNative(0x95384C6CE1526EFF, targetTag, redmSpeakerIconHash) --SetMpGamerTagSecondaryIcon
        Citizen.InvokeNative(0x84BD27DDF9575816, targetTag, redmColorYellowHash) --SetMpGamerTagColour
    else
        Citizen.InvokeNative(0x95384C6CE1526EFF, targetTag, nil) --SetMpGamerTagSecondaryIcon
        Citizen.InvokeNative(0x84BD27DDF9575816, targetTag, 0) --SetMpGamerTagColour
    end
end

--- Clears a single gamer tag (redm)
local function clearGamerTagRedm(targetTag)
    Citizen.InvokeNative(0x93171DDDAB274EB8, targetTag, redmGamerTagCompsEnum.none) --SetMpGamerTagVisibility
end

--- Setting game-specific functions
local setGamerTagFunc = IS_FIVEM and setGamerTagFivem or setGamerTagRedm
local clearGamerTagFunc = IS_FIVEM and clearGamerTagFivem or clearGamerTagRedm

--- Loops through every player, checks distance and draws or hides the tag
local function showGamerTags()
    rebuildTagConfig()
    local curCoords = GetEntityCoords(PlayerPedId())
    -- Per infinity this will only return players within 300m
    local allActivePlayers = GetActivePlayers()

    for _, pid in ipairs(allActivePlayers) do
        -- Resolving player
        local targetPed = GetPlayerPed(pid)
        local serverId = GetPlayerServerId(pid)
        local topTag = getPlayerTopTag(serverId)
        local tagPrefix = topTag and tagDisplayConfig[topTag] and tagDisplayConfig[topTag].prefix or ''

        -- If we have not yet indexed this player or their tag has somehow dissapeared (pause, etc)
        if
            not playerGamerTags[pid]
            or playerGamerTags[pid].ped ~= targetPed --ped can change if it leaves the networked area and back
            or not IsMpGamerTagActive(playerGamerTags[pid].gamerTag)
            or playerGamerTags[pid].topTag ~= topTag
        then
            -- Clean up old tag if it exists
            if playerGamerTags[pid] and IsMpGamerTagActive(playerGamerTags[pid].gamerTag) then
                if IS_FIVEM then
                    RemoveMpGamerTag(playerGamerTags[pid].gamerTag)
                else
                    Citizen.InvokeNative(0x839BFD7D7E49FE09, Citizen.PointerValueIntInitialized(playerGamerTags[pid].gamerTag))
                end
            end
            local playerName = string.sub(GetPlayerName(pid) or 'unknown', 1, 75)
            local playerStr = tagPrefix .. '[' .. serverId .. ']' .. ' ' .. playerName
            playerGamerTags[pid] = {
                ---@diagnostic disable-next-line: param-type-mismatch
                gamerTag = CreateFakeMpGamerTag(targetPed, playerStr, false, false, nil, 0),
                ped = targetPed,
                topTag = topTag,
            }
        end
        local targetTag = playerGamerTags[pid].gamerTag

        -- Distance Check
        local targetPedCoords = GetEntityCoords(targetPed)
        if #(targetPedCoords - curCoords) <= distanceToCheck then
            setGamerTagFunc(targetTag, pid)
        else
            clearGamerTagFunc(targetTag)
        end
    end
end

--- Starts the gamer tag thread
--- Increasing/decreasing the delay realistically only reflects on the
--- delay for the VOIP indicator icon, 250 is fine
local function createGamerTagThread()
    DebugPrint('Starting gamer tag thread')
    CreateThread(function()
        while isPlayerIdsEnabled do
            showGamerTags()
            Wait(250)
        end

        -- Remove all gamer tags and clear out active table
        cleanAllGamerTags()
    end)
end

--- Function to enable or disable the player ids
---@diagnostic disable-next-line: lowercase-global
function toggleShowPlayerIDs(enabled, showNotification)
    if not TX_MENU_ACCESSIBLE then
        return
    end

    isPlayerIdsEnabled = enabled
    local snackMessage
    if isPlayerIdsEnabled then
        snackMessage = 'nui_menu.page_main.player_ids.alert_show'
        createGamerTagThread()
    else
        snackMessage = 'nui_menu.page_main.player_ids.alert_hide'
    end

    if showNotification then
        SendSnackbarMessage('info', snackMessage, true)
    end
    DebugPrint('Show Player IDs Status: ' .. tostring(isPlayerIdsEnabled))
end

--- Receives the return from the server and toggles player ids on/off
RegisterNetEvent('txcl:showPlayerIDs', function(enabled)
    DebugPrint('Received showPlayerIDs event')
    toggleShowPlayerIDs(enabled, true)
end)

--- Sends perms request to the server to enable player ids
local function togglePlayerIDsHandler()
    TriggerServerEvent('txsv:req:showPlayerIDs', not isPlayerIdsEnabled)
end

RegisterSecureNuiCallback('togglePlayerIDs', function(_, cb)
    togglePlayerIDsHandler()
    cb({})
end)

RegisterCommand('txAdmin:menu:togglePlayerIDs', function()
    if not TX_MENU_ACCESSIBLE then
        return
    end
    if not DoesPlayerHavePerm(TX_MENU_PERMISSIONS, 'menu.viewids') then
        return SendSnackbarMessage('error', 'nui_menu.misc.no_perms', true)
    end
    togglePlayerIDsHandler()
end, false)
