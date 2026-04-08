local rad = math.rad
local sin = math.sin
local cos = math.cos
local min = math.min
local max = math.max
local type = type

function table.copy(x)
  local copy = {}
  for k, v in pairs(x) do
    if type(v) == 'table' then
        copy[k] = table.copy(v)
    else
        copy[k] = v
    end
  end
  return copy
end

function Protect(t)
  local fn = function (_, k)
    error('Key `' .. tostring(k) .. '` is not supported.')
  end

  return setmetatable(t, {
    __index = fn,
    __newindex = fn
  })
end

function CreateGamepadMetatable(keyboard, gamepad)
  return setmetatable({}, {
    __index = function (t, k)
      local src = IsGamepadControl() and gamepad or keyboard
      return src[k]
    end
  })
end

function Clamp(x, _min, _max)
  return min(max(x, _min), _max)
end

function ClampCameraRotation(rotX, rotY, rotZ)
  local x = Clamp(rotX, -90.0, 90.0)
  local y = rotY % 360
  local z = rotZ % 360
  return x, y, z
end

function IsGamepadControl()
  if IS_FIVEM then
    return not IsUsingKeyboard(2)
  else
    return not Citizen.InvokeNative(0xA571D46727E2B718, 2) -- IsUsingKeyboardAndMouse
  end
end

-- Keyboard controls mapped to raw VK key codes
-- Mouse/gamepad inputs still use GetDisabledControlNormal
local NATIVE_TO_RAW = {}
if IS_FIVEM then
  NATIVE_TO_RAW[19]  = 0xA4              -- INPUT_CHARACTER_WHEEL -> Left Alt
  NATIVE_TO_RAW[21]  = 0xA0              -- INPUT_SPRINT -> Left Shift
  NATIVE_TO_RAW[152] = 0x51              -- INPUT_PARACHUTE_BRAKE_LEFT -> Q
  NATIVE_TO_RAW[153] = 0x45              -- INPUT_PARACHUTE_BRAKE_RIGHT -> E
  NATIVE_TO_RAW[30]  = { 0x44, 0x41 }   -- INPUT_MOVE_LR -> D(+) / A(-)
  NATIVE_TO_RAW[31]  = { 0x53, 0x57 }   -- INPUT_MOVE_UD -> S(+) / W(-)
else
  NATIVE_TO_RAW[0x580C4473] = 0xA4              -- INPUT_HUD_SPECIAL -> Left Alt
  NATIVE_TO_RAW[0x8FFC75D6] = 0xA0              -- INPUT_SPRINT -> Left Shift
  NATIVE_TO_RAW[0x06052D11] = 0x51              -- INPUT_DIVE -> Q
  NATIVE_TO_RAW[0xD51B784F] = 0x45              -- INPUT_CONTEXT_Y -> E
  NATIVE_TO_RAW[0x4D8FB4C1] = { 0x44, 0x41 }   -- INPUT_MOVE_LR -> D(+) / A(-)
  NATIVE_TO_RAW[0xFDA83190] = { 0x53, 0x57 }   -- INPUT_MOVE_UD -> S(+) / W(-)
end

function GetSmartControlNormal(control)
  if type(control) == 'table' then
    local normal1 = GetDisabledControlNormal(0, control[1])
    local normal2 = GetDisabledControlNormal(0, control[2])
    return normal1 - normal2
  end

  return GetDisabledControlNormal(0, control)
end

function EulerToMatrix(rotX, rotY, rotZ)
  local radX = rad(rotX)
  local radY = rad(rotY)
  local radZ = rad(rotZ)

  local sinX = sin(radX)
  local sinY = sin(radY)
  local sinZ = sin(radZ)
  local cosX = cos(radX)
  local cosY = cos(radY)
  local cosZ = cos(radZ)

  local vecX = {}
  local vecY = {}
  local vecZ = {}

  vecX.x = cosY * cosZ
  vecX.y = cosY * sinZ
  vecX.z = -sinY

  vecY.x = cosZ * sinX * sinY - cosX * sinZ
  vecY.y = cosX * cosZ - sinX * sinY * sinZ
  vecY.z = cosY * sinX

  vecZ.x = -cosX * cosZ * sinY + sinX * sinZ
  vecZ.y = -cosZ * sinX + cosX * sinY * sinZ
  vecZ.z = cosX * cosY

  vecX = vector3(vecX.x, vecX.y, vecX.z)
  vecY = vector3(vecY.x, vecY.y, vecY.z)
  vecZ = vector3(vecZ.x, vecZ.y, vecZ.z)

  return vecX, vecY, vecZ
end
