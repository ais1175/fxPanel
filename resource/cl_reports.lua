-- =============================================
-- cl_reports.lua — Client-side report system
-- =============================================

-- =============================================
-- MARK: Report NUI communication
-- =============================================

--- Open the report UI
local isReportOpen = false

RegisterCommand('report', function()
    if isReportOpen then
        return
    end
    isReportOpen = true

    -- Open the NUI immediately so the player sees the panel
    SetNuiFocus(true, true)
    SendMenuMessage('openReportUI', { players = {} })

    -- Then fetch data from server (player list + tickets)
    TriggerServerEvent('txsv:reportOpen')
end, false)

--- Close report UI callback
RegisterSecureNuiCallback('reportClose', function(data, cb)
    isReportOpen = false
    SetNuiFocus(false, false)
    cb({})
end)

--- Submit new report callback
RegisterSecureNuiCallback('reportSubmit', function(data, cb)
    TriggerServerEvent('txsv:reportCreate', data)
    cb({})
end)

--- Fetch my reports callback
RegisterSecureNuiCallback('reportFetchMine', function(data, cb)
    TriggerServerEvent('txsv:reportGetMine')
    cb({})
end)

--- Send message on a report callback
RegisterSecureNuiCallback('reportSendMessage', function(data, cb)
    TriggerServerEvent('txsv:reportPlayerMessage', data)
    cb({})
end)

-- =============================================
-- MARK: Server → Client events
-- =============================================

--- Receive report open data (players + tickets)
RegisterNetEvent('txcl:reportOpenData', function(data)
    SendMenuMessage('openReportUI', {
        players = data.players or {},
    })
    SendMenuMessage('reportMyList', {
        reports = data.reports or {},
    })
end)

--- Receive report creation result
RegisterNetEvent('txcl:reportResult', function(data)
    SendMenuMessage('reportCreateResult', data)
end)

--- Receive player's report list (standalone refresh)
RegisterNetEvent('txcl:reportMyList', function(data)
    SendMenuMessage('reportMyList', data)
end)

--- Receive message send result
RegisterNetEvent('txcl:reportMessageResult', function(data)
    SendMenuMessage('reportMessageResult', data)
end)

--- Receive admin notification about new report
RegisterNetEvent('txcl:reportNotification', function(data)
    SendMenuMessage('reportNotification', data)
end)
