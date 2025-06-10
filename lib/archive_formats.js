/*
    {extension: command}
*/

const archiveFormatMap = {
    "tar": "tar xvf",
    "gz": "tar zxvf",
    "rar": "unrar e",
    "zip": "unzip"
};

export default archiveFormatMap;