const modulename = 'getOsDistro';
import si from 'systeminformation';
import consoleFactory from '@lib/console';
const console = consoleFactory(modulename);

/**
 * Cache calculated os distro
 */
let _osDistro;
export default async () => {
    if (_osDistro) return _osDistro;

    try {
        const osInfo = await si.osInfo();
        _osDistro = osInfo.distro || `${osInfo.platform} ${osInfo.release}`;
    } catch (error) {
        console.warn(`Failed to detect OS version with error: ${error.message}`);
        _osDistro = 'Unknown OS';
    }
    return _osDistro;
};
