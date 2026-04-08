-- =============================================
-- sv_reports.lua — Server-side report system handler
-- =============================================
if not TX_SERVER_MODE then
    return
end

local reportIntercomUrl = 'http://' .. TX_LUACOMHOST .. '/intercom/'

--- Helper to make intercom HTTP requests
---@param scope string
---@param payload table
---@param callback function
local function intercomRequest(scope, payload, callback)
    payload.txAdminToken = TX_LUACOMTOKEN
    PerformHttpRequest(reportIntercomUrl .. scope, function(httpCode, data, resultHeaders)
        if httpCode ~= 200 then
            TxPrintError(('[Reports] intercom/%s failed with code %s'):format(scope, httpCode))
            callback(nil)
            return
        end
        local parsed = json.decode(data)
        callback(parsed)
    end, 'POST', json.encode(payload), { ['Content-Type'] = 'application/json' })
end

--- Gets the player license from their identifiers
---@param src number
---@return string|nil
local function getPlayerLicense(src)
    local identifiers = GetPlayerIdentifiers(src)
    for _, id in ipairs(identifiers) do
        if string.sub(id, 1, 8) == 'license:' then
            return id
        end
    end
    return nil
end

-- =============================================
-- MARK: NUI Callback Handlers (called from client)
-- =============================================

--- Handle /report command — returns player list + open tickets
RegisterNetEvent('txsv:reportOpen', function()
    local src = source
    local license = getPlayerLicense(src)

    -- Build full server player list (excluding the reporter)
    local players = {}
    for _, serverID in pairs(GetPlayers()) do
        local sid = tonumber(serverID)
        if sid and sid ~= src then
            table.insert(players, {
                id = sid,
                name = GetPlayerName(serverID) or 'Unknown',
            })
        end
    end

    -- Fetch the player's open tickets
    if not license then
        return TriggerClientEvent('txcl:reportOpenData', src, { players = players, reports = {} })
    end

    intercomRequest('reportPlayerList', {
        playerLicense = license,
    }, function(result)
        local reports = (result and result.reports) or {}
        TriggerClientEvent('txcl:reportOpenData', src, { players = players, reports = reports })
    end)
end)

--- Handle report creation from client NUI
RegisterNetEvent('txsv:reportCreate', function(data)
    local src = source
    if type(data) ~= 'table' or type(data.type) ~= 'string' or type(data.reason) ~= 'string' then
        return TriggerClientEvent('txcl:reportResult', src, { error = 'Invalid report data.' })
    end

    local license = getPlayerLicense(src)
    if not license then
        return TriggerClientEvent('txcl:reportResult', src, { error = 'Could not identify your license.' })
    end

    local reporter = {
        license = license,
        name = GetPlayerName(src) or 'Unknown',
        netid = src,
    }

    local targets = {}
    if data.type == 'playerReport' then
        local targetIds = data.targetIds
        if type(targetIds) == 'table' then
            for _, tid in ipairs(targetIds) do
                if type(tid) == 'number' and DoesPlayerExist(tid) then
                    local targetLicense = getPlayerLicense(tid)
                    table.insert(targets, {
                        license = targetLicense or 'unknown',
                        name = GetPlayerName(tid) or 'Unknown',
                        netid = tid,
                    })
                end
            end
        end
    end

    intercomRequest('reportCreate', {
        type = data.type,
        reporter = reporter,
        targets = targets,
        reason = data.reason,
    }, function(result)
        if result and result.reportId then
            TriggerClientEvent('txcl:reportResult', src, { success = true, reportId = result.reportId })
        else
            local errMsg = (result and result.error) or 'Failed to create report.'
            TriggerClientEvent('txcl:reportResult', src, { error = errMsg })
        end
    end)
end)

--- Handle fetching player's own reports
RegisterNetEvent('txsv:reportGetMine', function()
    local src = source
    local license = getPlayerLicense(src)
    if not license then
        return TriggerClientEvent('txcl:reportMyList', src, { error = 'Could not identify your license.' })
    end

    intercomRequest('reportPlayerList', {
        playerLicense = license,
    }, function(result)
        if result and result.reports then
            TriggerClientEvent('txcl:reportMyList', src, result)
        else
            local errMsg = (result and result.error) or 'Failed to get reports.'
            TriggerClientEvent('txcl:reportMyList', src, { error = errMsg })
        end
    end)
end)

--- Handle player sending a message on their own report
RegisterNetEvent('txsv:reportPlayerMessage', function(data)
    local src = source
    if type(data) ~= 'table' or type(data.reportId) ~= 'string' or type(data.content) ~= 'string' then
        return TriggerClientEvent('txcl:reportMessageResult', src, { error = 'Invalid message data.' })
    end

    local license = getPlayerLicense(src)
    if not license then
        return TriggerClientEvent('txcl:reportMessageResult', src, { error = 'Could not identify your license.' })
    end

    intercomRequest('reportPlayerMessage', {
        reportId = data.reportId,
        playerLicense = license,
        content = data.content,
    }, function(result)
        if result and result.success then
            TriggerClientEvent('txcl:reportMessageResult', src, { success = true })
        else
            local errMsg = (result and result.error) or 'Failed to send message.'
            TriggerClientEvent('txcl:reportMessageResult', src, { error = errMsg })
        end
    end)
end)

-- =============================================
-- MARK: Event handler for admin notifications
-- =============================================
TX_EVENT_HANDLERS.reportCreated = function(eventData)
    -- Notify all online admins
    for netid, admin in pairs(TX_ADMINS) do
        TriggerClientEvent('txcl:reportNotification', netid, {
            reportId = eventData.reportId,
            type = eventData.type,
            reporterName = eventData.reporterName,
            reason = eventData.reason,
        })
    end
end
