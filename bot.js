const { Markup, Telegraf } = require('telegraf')
const { log } = require('console');
const arGs = require('./commandArgs');
const MongoClient = require("mongodb").MongoClient;
const axios = require('axios');
const fs = require('fs')
//const request = require('request');

const _DEBUG = false;

let rootPassword;
if (_DEBUG) {
    rootPassword = "1488";
} else {
    rootPassword = process.env.ROOTPASSWORD;
}

let documentFolderPrefix;
if (_DEBUG) {
    documentFolderPrefix = "./";
} else {
    documentFolderPrefix = process.env.DOCUMENTFOLDER;
}

let musicFolderPrefix;
if (_DEBUG) {
    musicFolderPrefix = "./";
} else {
    musicFolderPrefix = process.env.MUSICFOLDER;
}

let token;
if (_DEBUG) {
    token = fs.readFileSync('../telegramkey.txt', 'utf8');
} else {
    token = process.env.TOKEN;
}
let name = "DownLBot";

const bot = new Telegraf(token)
const _setting = { useUnifiedTopology: true, connectTimeoutMS: 30000, keepAlive: 1 };
bot.use(arGs());

let _url;
if (_DEBUG) {
    _url = 'mongodb://root:password@192.168.1.100:27020/';
} else {
    _url = process.env.MONGOURL;
}

const _DB = "DownLBot";
const _UserSettings = 'UserSettings';

class UserSettings {
    static Table = _UserSettings;

    Settings = {
        User: '',
        WhatUploading: '',
        MusicFolder: '',
        DocumentFolder: ''
    }

    constructor(User, MusicFolder = "", DocumentFolder = "", WhatUploading = "") {
        this.Settings.User = User;
        this.Settings.MusicFolder = MusicFolder;
        this.Settings.DocumentFolder = DocumentFolder;
        this.Settings.WhatUploading = WhatUploading;
    }

    static insertUserSettings(usersettings, clb = () => { }) {
        const mongoClient = new MongoClient(_url, _setting);
        mongoClient.connect(function (err, client) {
            const db = client.db(_DB);
            const collection = db.collection(UserSettings.Table);
            collection.insertOne(usersettings, function (err, result) {
                if (err) {
                    return console.log(err, 'err');
                }
                clb(usersettings);
                client.close();
            });
        });
    }

    static updateUserSettings(usersettings, clb = (tr) => { if (_DEBUG) console.log(`Update: ${tr}`) }) {
        const mongoClient = new MongoClient(_url, _setting);
        mongoClient.connect(function (err, client) {
            if (err) console.log(err, 'err');
            const db = client.db(_DB);
            const collection = db.collection(UserSettings.Table);
            var newvalues = { $set: { 'Settings': usersettings.Settings } }
            collection.updateOne({ 'Settings.User': usersettings.Settings.User }, newvalues, function (err, res) {
                if (err) { clb(false); return false; };
                clb(true);
                client.close();
            });
        })
    }

    static getUserSettings(user, clb) {
        const mongoClient = new MongoClient(_url, _setting);
        mongoClient.connect(function (err, client) {
            if (err) return console.log(err, 'err');
            const db = client.db(_DB);
            db.collection(UserSettings.Table).findOne({ 'Settings.User': user }, function (err, result) {
                if (err) { console.log(err, 'err'); return null; }
                client.close();
                clb(result);
            });
        });
    }

    /**
     * @returns {UserSettings}
    */
    static createObj(UserSettings) {
        return Object.assign(UserSettings, UserSettings);
    }
}

class dbWork {
    static createDBandTABLE() {
        dbWork.creatTable(_UserSettings);
    }

    static jsonRead(jsonName, tableName) {
        /*Load JSON*/
        const ww = JSON.parse(fs.readFileSync(`json/${jsonName}.json`, 'utf8'));
        var ii = Object.keys(ww).map(key => {
            return ww[key];
        })
        const mongoClient = new MongoClient(_url, _setting);
        mongoClient.connect(function (err, client) {
            const db = client.db(_DB);
            const collection = db.collection(tableName);
            collection.insertMany(ii, function (err, result) {
                if (err) {
                    return console.log(err, 'err');
                }
                client.close();
            });
        });
    }

    static creatTable(table, json = undefined, clb = undefined) {
        console.log(`Check ${table}`)
        const client = new MongoClient(_url, _setting);
        client.connect(function (err) {
            if (err) { console.log(`Database ${_DB} not EXIST!!! Create IT NOW!!!!`); return false; };
            var db = client.db(_DB);
            db.createCollection(table, function (err, res) {
                if (err?.code != 48) { console.log(err, 'err'); clb ? clb() : console.log(`${table} no clb`); }
                if (json != undefined) { dbWork.jsonRead(json, table) }
                console.log(`Collection ${table} created!`);
                client.close();
            });
        });
    }
}

//triggers
let changeMusicFolder = {
    login: "",
    process: false
}
//

bot.command("start", (ctx) => {
    let user = ctx.from.username;
    UserSettings.getUserSettings(user, (settings) => {
        if (settings) {
            let sett = UserSettings.createObj(settings);
            if (sett.Settings.MusicFolder && sett.Settings.DocumentFolder) {
                const inlineMessageRatingKeyboard = Markup.inlineKeyboard([
                    Markup.button.callback('🎵 Music upload', `${user}_music`),
                    Markup.button.callback('🖨️ Docs upload', `${user}_docs`),
                ]);

                ctx.reply(`What you wonna upload?\nYour music folder: ${sett.Settings.MusicFolder}\nYour docs folder: ${sett.Settings.DocumentFolder}`, { ...inlineMessageRatingKeyboard });
            } else {//Crete new settings
                if (sett.Settings.MusicFolder) {
                    ctx.reply("Chose new document folder, '/folderD foldername' in chat");
                } else {
                    ctx.reply("Chose new music folder, type: '/folderM foldername' in chat\nChose new document folder, '/folderD foldername' in chat");
                }
            }
        } else {//Crete new settings
            ctx.reply("Pass password verefication by '/pass password'");
            //ctx.reply("Chose new music folder, type: '/folderM foldername' in chat\nChose new document folder, '/folderD foldername' in chat");
        }
    })
})

bot.command("pass", (ctx) => {
    let pass = ctx.state.command.args[0];
    if (pass) {
        UserSettings.getUserSettings(ctx.from.username, (settings) => {
            if (settings) {
                ctx.reply(`You already logined!`);
            } else {
                if (pass === rootPassword) {
                    UserSettings.insertUserSettings(new UserSettings(ctx.message.from.username), (result) => {
                        if (result) {
                            ctx.reply(`Now you are registered\nType /start again and configure your folders`);
                        } else {
                            ctx.reply(`Error on creating user`);
                        }
                    })
                } else {
                    ctx.reply('Wrong password!')
                }
            }
        });
    }
})

const regexMusic = new RegExp(/(.+)_music/i)
bot.action(regexMusic, (ctx) => {
    const WhatUploading = "music";
    let user = ctx.match[1];
    if (user) {
        changeWhatUpaload(ctx, user, WhatUploading);
    }
})

const regexDocs = new RegExp(/(.+)_docs/i)
bot.action(regexDocs, (ctx) => {
    const WhatUploading = "docs";
    let user = ctx.match[1];
    if (user) {
        changeWhatUpaload(ctx, user, WhatUploading);
    }
})

function changeWhatUpaload(ctx, user, whatUpload) {
    UserSettings.getUserSettings(user, (settings) => {
        if (settings) {
            settings.Settings.WhatUploading = whatUpload;
            UserSettings.updateUserSettings(settings, (result) => {
                if (result) {
                    ctx.answerCbQuery(`You ${user} - selected ${whatUpload} uploading!`);
                } else {
                    ctx.answerCbQuery("Error on selecting!")
                }
            })
        } else {
            ctx.answerCbQuery("Error on selecting!");
        }
    })
}

bot.command("folderM", (ctx) => {
    const folderName = "Music";
    let folder = ctx.state.command.args[0];
    if (folder) {
        UserSettings.getUserSettings(ctx.from.username, (settings) => {
            if (settings) {
                settings.Settings.MusicFolder = folder;
                UserSettings.updateUserSettings(settings, (result) => {
                    if (result) {
                        ctx.reply(`You changed your ${folderName} folder to ${folder}`);
                    } else {
                        ctx.reply(`Error on changing ${folderName} folder to ${folder}`);
                    }
                })
            } else {
                UserSettings.insertUserSettings(new UserSettings(ctx.message.from.username, folder), (result) => {
                    if (result) {
                        ctx.reply(`${folderName} folder setted: ${folder}`);
                    }
                })
            }
        });
    }
})

bot.command("folderD", (ctx) => {
    const folderName = "Document";
    let folder = ctx.state.command.args[0];
    if (folder) {
        UserSettings.getUserSettings(ctx.from.username, (settings) => {
            if (settings) {
                settings.Settings.DocumentFolder = folder;
                UserSettings.updateUserSettings(settings, (result) => {
                    if (result) {
                        ctx.reply(`You changed your ${folderName} folder to ${folder}`);
                    } else {
                        ctx.reply(`Error on changing ${folderName} folder to ${folder}`);
                    }
                })
            } else {
                UserSettings.insertUserSettings(new UserSettings(ctx.message.from.username, "", folder), (result) => {
                    if (result) {
                        ctx.reply(`${folderName} folder setted: ${folder}`);
                    }
                })
            }
        });
    }
})

function downloadFile(ctx,url,path,fileName,num=1) {
    console.log(`Download ${fileName} from ${url}`);
    axios.get(url.href, { responseType: "arraybuffer" }).then((file) => {
        if (!fs.existsSync(path)) {
            fs.writeFile(path, file.data, (err) => {
                if (!err) {
                    let resp = `[OK] File ${fileName} was uploaded to ${path}`;
                    console.log(resp);
                    ctx.reply(resp);
                } else {
                    let resp = `[ERROR] Error on uploading ${err}`;
                    console.log(resp);
                    ctx.reply(resp);
                }
            })
        } else {
            let resp = `[ERROR] Error ${fileName} already exist on path: ${path}`;
            console.log(resp);
            ctx.reply(resp);
        }
    }).catch(function (error) {
        let resp = `[ERROR DW] ${error} when download ${fileName} from ${url}, try again ${num} time (5 sec.)`;
        console.log(resp);
        ctx.reply(resp);
        if(num < 3){
            setTimeout(()=>{
                downloadFile(ctx,url,path,fileName,++num);
            },5000);
        }
    })
}

bot.on('message', (ctx) => {
    let user = ctx.from.username;
    UserSettings.getUserSettings(user, (settings) => {
        if (settings) {
            let sett = UserSettings.createObj(settings);
            if (sett.Settings.WhatUploading === "music") {
                if (ctx.update.message.audio) {
                    let fileName = ctx.update.message.audio.file_name;
                    let fileId = ctx.update.message.audio.file_id;
                    ctx.telegram.getFileLink(fileId).then((url) => {
                        let path = `${musicFolderPrefix}/${sett.Settings.MusicFolder}/${fileName}`;
                        downloadFile(ctx,url,path,fileName);
                    }).catch(function (error) {
                        let resp = `[ERROR TG] ${error}`;
                        console.log(resp);
                        ctx.reply(resp);
                    })
                } else {
                    let resp = `[ERROR] File is not audio`;
                    console.log(resp);
                    ctx.reply(resp);
                }
            } else if (sett.Settings.WhatUploading === "docs") {
                if (ctx.update.message.document) {
                    let fileName = ctx.update.message.document.file_name;
                    let fileId = ctx.update.message.document.file_id;
                    ctx.telegram.getFileLink(fileId).then((url) => {
                        let path = `${documentFolderPrefix}/${sett.Settings.DocumentFolder}/${fileName}`;
                        downloadFile(ctx,url,path,fileName);
                    }).catch(function (error) {
                        let resp = `[ERROR TG] ${error}`;
                        console.log(resp);
                        ctx.reply(resp);
                    })
                } else {
                    let resp = `[ERROR] File is not document`;
                    console.log(resp);
                    ctx.reply(resp);
                }
            }
        } else {
            ctx.message('Please use /start to start');
        }
    })
})

dbWork.createDBandTABLE();

bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))