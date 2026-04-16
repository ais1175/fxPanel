--[[ Helper Functions ]]
--
local function logError(x)
    TxPrint('^1' .. x)
end

local svName = GetConvar('txAdmin-serverName', 'txAdmin')
local hideAdmin = GetConvarBool('txAdmin-hideAdminInPunishments')

--[[ Initial Data Cache ]]
--
local CLEANUP_INTERVAL = 60 * 1000
local MAX_AGE = 5 * 60 * 1000
local initialDataCache = {}

local function cacheData(data)
    data.ts = GetGameTimer()
    initialDataCache[data.netId] = data
end

local function popData(netId)
    if not initialDataCache[netId] then
        return nil
    end
    local data = initialDataCache[netId]
    initialDataCache[netId] = nil
    return data
end

CreateThread(function()
    while true do
        local now = GetGameTimer()
        for netId, data in pairs(initialDataCache) do
            if now - data.ts > MAX_AGE then
                initialDataCache[netId] = nil
            end
        end

        Wait(CLEANUP_INTERVAL)
    end
end)

--[[ Handle Commands/Events ]]
--
local function useInitData(data)
    if not data then
        return
    end
    -- Store tags on the player's entry in TX_PLAYERLIST
    if data.tags ~= nil then
        local pidStr = tostring(data.netId)
        if TX_PLAYERLIST[pidStr] ~= nil then
            TX_PLAYERLIST[pidStr].tags = data.tags
        end
    end
    -- Send pending warn to the client for local storage.
    -- The client will display it when the player starts walking,
    -- without needing a server round-trip.
    if data.pendingWarn ~= nil then
        local authorName = hideAdmin and svName or data.pendingWarn.author or 'anonym'
        -- Register in the pending warnings table so the ack handler can find it
        TX_PENDING_WARNINGS[tostring(data.netId)] = data.pendingWarn.actionId
        TriggerClientEvent('txcl:setPendingWarn', data.netId, {
            author = authorName,
            reason = data.pendingWarn.reason,
            actionId = data.pendingWarn.actionId,
        })
    end
end

RegisterCommand('txaInitialData', function(source, args)
    -- sanity check
    if type(args[1]) ~= 'string' then
        return TxPrintError('[txaInitialData] invalid argument types', type(args[1]))
    end

    -- prevent execution from admins or resources
    if source ~= 0 then
        return TxPrintError('[txaInitialData] unexpected source', source)
    end
    if GetInvokingResource() ~= nil then
        return TxPrintError('[txaInitialData] unexpected invoking resource', GetInvokingResource())
    end

    -- processing event
    local initialData = json.decode(ReplaceSemicolon(args[1]))
    if not initialData or type(initialData.netId) ~= 'number' then
        return TxPrintError('[txaInitialData] invalid eventData', args[1])
    end

    -- Apply tags to TX_PLAYERLIST immediately if player entry exists
    if initialData.tags ~= nil then
        local pidStr = tostring(initialData.netId)
        if TX_PLAYERLIST[pidStr] ~= nil then
            TX_PLAYERLIST[pidStr].tags = initialData.tags
        end
    end

    cacheData(initialData)
    useInitData(initialData)
    CancelEvent()
end, true)
