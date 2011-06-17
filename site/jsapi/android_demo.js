// Inject a new API into navigator to present a merged web & native app list
navigator.apps = (function() {
    var _state;
    var _nativeApps = {};
    var _demoNativeApps = {
        "Camera":"", "Slacker":"", "Video":"", "Gmail":"", "Swype":"",
        "AllShare":"", "YouTube":"", "Market":"", "My files":"",
        "Sound Recorder":"", "Blockbuster":"", "Amazon Kindle":"",
        "Google Search":"", "Contacts":"", "Calendar":"", "Messaging":"",
        "NYTimes":"", "Clock":"", "Contacts":"", "Email":"", "Music":"",
        "Fennec":"", "Browser":"", "Settings":"", "Talk":"", "Latitude":""
    };
    var webapps = {
    "http://tubagames.net": {
        "origin": "http://tubagames.net",
        "src_url": "http://tubagames.net/barfight_manifest.php",
        "manifest": {
            "icons": {
                "128": "/barfight/images/webappicon_128.png"
            },
            "installs_allowed_from": [
                "*"
            ],
            "developer": {
                "url": "http://www.tubagames.net",
                "name": "TuBaGames"
            },
            "name": "BarFight",
            "description": "BarFight is set in a 1950's Hollywood Western movie set - where the extras compete to impress the director as the inevitable bar fight breaks out. The game is an MMO and a chat room. You can meet up with your friends, chat, play a round of poker, listen to the piano player as you watch the dancing girls...oh...and smash each other over the head with chairs of course! All in glorious third person perspective (also in actual 3D if you bring your own glasses!). The wardrobe department lets you customize your character and set your stats."
        }
    },
    "http://www.davesgalaxy.com": {
        "origin": "http://www.davesgalaxy.com",
        "src_url": "http://www.davesgalaxy.com/site_media/mozilla.manifest",
        "manifest": {
            "widget": {
                "path": "/demo/",
                "height": 800,
                "width": 1000
            },
            "name": "Dave's Galaxy",
            "icons": {
                "128": "/site_media/icon128.png",
                "48": "/site_media/icon48.png",
                "16": "/site_media/favicon.png"
            },
            "installs_allowed_from": [
                "*"
            ],
            "description": "Conquer the Galaxy in less than 10 Minutes a Day",
            "version": "1.0",
            "developer": {
                "url": "http://blog.davesgalaxy.com/blog",
                "name": "Dave Case"
            }
        }
    },
    "http://www.matthewhollett.com": {
        "origin": "http://www.matthewhollett.com",
        "src_url": "http://www.matthewhollett.com/favimon/manifest.webapp",
        "manifest": {
            "name": "Favimon (beta)",
            "icons": {
                "128": "/favimon/images/favimon-icon-128.png"
            },
            "installs_allowed_from": [
                "*"
            ],
            "description": "Favimon is a web-based game in which you battle your favourite websites, building a collection of icons as you attempt to conquer the web! Works best in Firefox 3.6+.",
            "launch_path": "/favimon/",
            "developer": {
                "url": "http://www.matthewhollett.com/",
                "name": "Matthew Hollett"
            }
        }
    },
    "http://shazow.net": {
        "origin": "http://shazow.net",
        "src_url": "http://shazow.net/linerage/gameon/manifest.json",
        "manifest": {
            "name": "LineRage",
            "icons": {
                "128": "/linerage/gameon/icon_128.png",
                "32": "/linerage/gameon/icon_32.png",
                "16": "/linerage/gameon/icon_16.png"
            },
            "installs_allowed_from": [
                "*"
            ],
            "description": "You are a line. Don't hit things.",
            "launch_path": "/linerage/gameon/index.html",
            "developer": {
                "url": "http://shazow.net",
                "name": "Andrey Petrov"
            }
        }
    },
    "http://marblerun.at": {
        "origin": "http://marblerun.at",
        "src_url": "http://marblerun.at/manifest.webapp",
        "manifest": {
            "icons": {
                "128": "/images/webapp_icon.png"
            },
            "installs_allowed_from": [
                "*"
            ],
            "developer": {
                "url": "http://marblerun.at/about",
                "name": "MARBLE RUN Team"
            },
            "name": "MARBLE RUN",
            "description": "What is MARBLE RUN all about? It's about fun and easy gameplay. It's about creativeness and playfulness. It's about being a part of a big piece, actually a big marble run. Everyone is invited to build a track and add it to the big marble run. By doing so we will all create the longest marble run ever in history. The longer the run gets, the more special bricks will be available allowing us to build even more creative and awesome tracks.Long story short - it's all about building stuff like we all did when we were little kids."
        }
    },
    "http://regamez.com": {
        "origin": "http://regamez.com",
        "src_url": "http://regamez.com/madtanks/mozilla.webapp",
        "manifest": {
            "name": "Mad Tanks TD",
            "icons": {
                "128": "/madtanks/icon128.png"
            },
            "installs_allowed_from": [
                "*"
            ],
            "description": "Tower Defense game. In the future wars will be fought by automated tanks. In the year of 2070 something went wrong with the A.I. and now you have to defend against mad machines. There are 20 bases to defend. Killing all tanks gives you a perfect win. Please read in-game help for keyboard shortcuts. IE is not supported, it works, but poorly.",
            "launch_path": "/madtanks",
            "developer": {
                "url": "http://www.refuture.eu",
                "name": "ReFuture"
            }
        }
    },
    "http://appmanifest.org": {
        "origin": "http://appmanifest.org",
        "src_url": "http://appmanifest.org/manifest.webapp",
        "manifest": {
            "name": "Manifest Checker",
            "icons": {
                "128": "/img/logo_128.png"
            },
            "installs_allowed_from": [
                "http://people.mozilla.org",
                "http://apps.mozillalabs.com",
                "https://apps.mozillalabs.com"
            ],
            "description": "A development tool and demonstration app that helps you check your open web app manifests.",
            "launch_path": "/",
            "developer": {
                "url": "http://mozillalabs.com",
                "name": "Mozilla Labs"
            }
        }
    },
    "http://openodyssey.mibbu.eu": {
        "origin": "http://openodyssey.mibbu.eu",
        "src_url": "http://openodyssey.mibbu.eu/manifest.php",
        "manifest": {
            "name": "OpenOdyssey",
            "icons": {
                "128": "/icon_128.png"
            },
            "installs_allowed_from": [
                "*"
            ],
            "description": "Help mythical Odysseus to return home in classical top-down shooter.",
            "launch_path": "/game/index.html",
            "developer": {
                "url": "http://michalbe.blogspot.com",
                "name": "Michal Budzynski"
            }
        }
    },
    "http://photobooth.mozillalabs.com": {
        "origin": "http://photobooth.mozillalabs.com",
        "src_url": "http://photobooth.mozillalabs.com/rainbooth.webapp",
        "manifest": {
            "name": "Rainbooth",
            "default_locale": "en",
            "icons": {
                "128": "/i/rainbow_128.png",
                "256": "/i/rainbow.png",
                "48": "/i/rainbow_48.png"
            },
            "installs_allowed_from": [
                "https://apps.mozillalabs.com"
            ],
            "description": "Snap pictures and share them with friends!",
            "version": "0.1",
            "developer": {
                "url": "http://mozillalabs.com",
                "name": "Mozilla Labs"
            }
        }
    },
    "http://raptjs.com": {
        "origin": "http://raptjs.com",
        "src_url": "http://raptjs.com/manifest.webapp",
        "manifest": {
            "name": "Robots Are People Too",
            "icons": {
                "128": "/images/icon_128.png"
            },
            "installs_allowed_from": [
                "*"
            ],
            "description": "RAPT is a complex and challenging HTML5 platformer.  The exit to each level is blocked by enemies that roll, jump, fly, and shoot to prevent escape at all costs.  Gameplay is exclusively two-player and uses a unique split-screen mechanic.  The levels and enemies are designed to promote cooperation between players.\u000a\u000aRAPT also comes with a powerful level editor which allows players to create levels of any size.  Levels are saved to the player's account on the server, which has a public page listing custom levels.  Link to this page to share your levels with friends.",
            "launch_path": "/play/",
            "developer": {
                "url": "http://raptjs.com",
                "name": "Robots Are People Too"
            }
        }
    },
    "http://www.limejs.com": {
        "origin": "http://www.limejs.com",
        "src_url": "http://www.limejs.com/roundball.webapp",
        "manifest": {
            "name": "Roundball",
            "icons": {
                "128": "/static/roundball_icon_128.png"
            },
            "installs_allowed_from": [
                "*"
            ],
            "description": "Roundball is a fun match three puzzle game where you form horizontal or vertical lines of at least three similar objects by swapping two adjacent items. The more matches you make, the higher your score. Two game modes: Classic and Timed mode. Works on regular computer or on touchscreens.",
            "launch_path": "/static/roundball/index.html",
            "developer": {
                "url": "http://www.limejs.com/",
                "name": "Digital Fruit"
            }
        }
    },
    "http://sinuousgame.com": {
        "origin": "http://sinuousgame.com",
        "src_url": "http://sinuousgame.com/manifest.webapp",
        "manifest": {
            "name": "Sinuous",
            "icons": {
                "128": "/assets/images/icon_128.png"
            },
            "installs_allowed_from": [
                "*"
            ],
            "description": "Avoid the red dots in this fun and addictive game.",
            "launch_path": "/",
            "developer": {
                "url": "http://hakim.se/experiments/",
                "name": "Hakim El Hattab"
            }
        }
    },
    "http://hakim.se": {
        "origin": "http://hakim.se",
        "src_url": "http://hakim.se/experiments/html5/sketch/manifest.webapp",
        "manifest": {
            "name": "Sketch",
            "icons": {
                "128": "/experiments/html5/sketch/images/icon_128.png"
            },
            "installs_allowed_from": [
                "*"
            ],
            "description": "Draw sketches with animating lines in pseudo 3D",
            "launch_path": "/experiments/html5/sketch/",
            "developer": {
                "url": "http://hakim.se/experiments/",
                "name": "Hakim El Hattab"
            }
        }
    },
    "http://www.paulbrunt.co.uk": {
        "origin": "http://www.paulbrunt.co.uk",
        "src_url": "http://www.paulbrunt.co.uk/steamcube/manifest.webapp",
        "manifest": {
            "name": "Steamcube",
            "icons": {
                "128": "/steamcube/icon.png"
            },
            "installs_allowed_from": [
                "*"
            ],
            "description": "A simple 2.5D brain teaser block puzzle game. Find out how far can you get before time runs out?",
            "launch_path": "/steamcube/index.php",
            "developer": {
                "url": "http://www.glge.org",
                "name": "Paul Brunt"
            }
        }
    },
    "http://stillalivejs.t4ils.com": {
        "origin": "http://stillalivejs.t4ils.com",
        "src_url": "http://stillalivejs.t4ils.com/play/manifest.webapp",
        "manifest": {
            "name": "StillAliveJS",
            "icons": {
                "128": "/play/images/icon128.png"
            },
            "installs_allowed_from": [
                "*"
            ],
            "description": "StillAliveJS, or SaJS, is a puzzle game inspired by Portal: The Flash Version which is a 2D renewal of Portal, developed by Valve Corporation.\u000a\u000aSaJS consists primarily in a series of platform puzzles that must be solved by teleporting the character and other simple objects using a Portal Gun. The unusual physics allowed by this device is the emphasis of StillAliveJS.",
            "launch_path": "/play/index.html",
            "developer": {
                "url": "http://stillalivejs.t4ils.com/",
                "name": "t4ils and Zeblackos"
            }
        }
    },
    "http://www.harmmade.com": {
        "origin": "http://www.harmmade.com",
        "src_url": "http://www.harmmade.com/vectorracer/manifest.webapp",
        "manifest": {
            "name": "Vector Racer",
            "icons": {
                "128": "/vectorracer/images/vectorracer_icon_128.png"
            },
            "installs_allowed_from": [
                "*"
            ],
            "description": "Vector Racer is a turn-based racing game, which simulates a car race on a squared sheet of paper. You move from one grid point to another and have to try to get to the finish in the least amount of turns.",
            "launch_path": "/vectorracer/",
            "developer": {
                "url": "http://www.harmboschloo.com/",
                "name": "Harm Boschloo"
            }
        }
    },
    "http://websnooker.com": {
        "origin": "http://websnooker.com",
        "src_url": "http://websnooker.com/manifest.webapp",
        "manifest": {
            "icons": {
                "128": "/media/images/icon_128.png"
            },
            "installs_allowed_from": [
                "*"
            ],
            "developer": {
                "url": "http://pordesign.eu",
                "name": "Por Design"
            },
            "name": "Web Snooker",
            "description": "Free online web-based snooker game"
        }
    },
    "http://www.phoboslab.org": {
        "origin": "http://www.phoboslab.org",
        "src_url": "http://www.phoboslab.org/ztype/manifest.webapp",
        "manifest": {
            "name": "Z-Type",
            "icons": {
                "128": "/ztype/media/icon-128.png"
            },
            "installs_allowed_from": [
                "*"
            ],
            "description": "A Space Shoot'em'up where you type to shoot.",
            "launch_path": "/ztype/",
            "developer": {
                "url": "http://www.phoboslab.org/",
                "name": "Dominic Szablewski"
            }
        }
    },
    "http://www.limejs.com": {
        "origin": "http://www.limejs.com",
        "src_url": "http://www.limejs.com/zlizer.webapp",
        "manifest": {
            "name": "Zlizer",
            "icons": {
                "128": "/static/zlizer_icon_128.png"
            },
            "installs_allowed_from": [
                "*"
            ],
            "description": "Slice or join quicly! Simple and entertaining math game. Add or divide quickly to get magic number as the numbers fall, or you'll lose! It's speed math! Works on regular computer or on touchscreens.",
            "launch_path": "/static/zlizer/index.html",
            "developer": {
                "url": "http://www.limejs.com/",
                "name": "Digital Fruit"
            }
        }
    },
    "http://www.nytimes.com": {
        "origin": "http://www.nytimes.com",
        "manifest": {
            "name": "NYT Web",
            "icons": {
                "64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAABLCAYAAAA4TnrqAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAFUNJREFUeNqUnHXMXVXWxvf79qLFnUKx4m6F4FpcAgT3IUggaELwIH8QIGSQD/kgQDOTYCEE1yJBSnC3QhncXVoKVOb+9nSdPPdhncvMTc5733tky9pLn7X2GXjzzTfLwMBA4TPjjDOOmjZt2j4TJ05cbsqUKUO656eVv/h072+e/1+u6fW2+zjPp60Nzk+dOrXnurb1v45t+rmBwcHBKUOHDh3X/feG33//fUwzDojVvdjpfv7vvffeO+K5554rX375ZTpIfneJ2JzPBtVtq05AzwdB2gaZTdon5W1khItrHIyjjeDxf/QZ8+KZeH6hhRYqI0eOLEsvvfT///HHH0d3z00eeOONN8pMM8101dixYw976KGHagMzzDBD/R4yZEh9MBoNQmgnOiAfIL8nT55cv52DlKui3X7EisnphPWa3sO44xPPBCHiOR9LtBGE46CdLbfcsqy//vpXdzns8IFx48ZtOX78+DE33XRTbVAHHh14g9qZc0rG2vpcxl3+DP1nnKGE5ZsJxT0sMAujk9Y+4z59XjlRn+N6MAmfvffeu4wYMWLUYLfDA5955pnSZbU/sTiDicaC2sFZysYxee0kDh2MilQ8zxHtMtnsWT1iHNyrkwxCxbijzXjO+4pvXSDugw7RViwA9IFOnQkTJiz7xRdfVJZzUYgGgo2DIMrSNKbcpgPQFY3nVIz1unNbEEa5W/WhLpaed4nwe1UsnSHiE9cgHP+jw6FTJyarLKi6pp/uUGXvg1G2zp5Vojtn6rPK7UpoJY4S1c+3WdFYDDUI8XwwTvwOTh6cNn0kOpBoRCfO7xCTuO6coYRwztQ+dPI6MdUlcV8siHKnt60T13ZVfPWZmINacF3wmKdeh04d1QOhNNuUo6+MntdVUa5Tvdam60LEnRuUg1UfcV+svhPdxS6smktDWPq2OcZ4leAdV4JuXlV3ZL6WynkMIAYYg2uzqjEpb8/1hz7rLkAoevfV9P8gti6IjiPzt+K5MDz831Gr4auX+U9u2eJ3dOIDjgkFBykB9FC/zh1R517XjWo41KfzsTqhMzcnxqxzjvs7erP6Ka6Eg1vcIup9rsuUcCqGQTznNF3hjGiqeEOvYLG43g3VejhbDYQbD11UJY7qRbXycc+fdJZaRdcHmRJ3R1UVLoNXMVQfRzmNTzfc6hmsO4uub1ZeeeWy0korldlnn718/fXX5aWXXioffvhhJV43Ikm5P1P8Ks7qHsXi6P0dt3hOFI+71F9SPZI5ncFpTKAbLtT75plnnnrACT/99FM9fvzxx/Lrr79WJxCiubftvh7tvfLKK+Wtt94qCy+8cNljjz3KvvvuW8/deeed5cUXX6ztZ2N3d8Z1my6gSkqPgs8cxXgwxDNWXH+7MdCB8P3bb7/V1d9kk02IscqSSy5ZZp111sZE//DDD+Xjjz8u77zzTnn99dfLRx99VH755Zd6HcIxabeKXKPd7777rgAE3HbbbeXKK68s2223XVl11VXLrbfeWq6//vomfMuspLs4f+UcVwUf2l4VdaZcXcG7Mo9O1FRPmjSprLfeemX//fcvSyyxREP4GBziQnS/6KKL1vvgvk8//bS89tpr5fnnny/vvvtu5boQU44Y38wzz1yGDh1aOeurr74qN998c9l2221r23Aai3D77bfX+1Qnuc7MIgN3thud5UFqm7hp4Jopd2friRMnlp122qkcfvjh9TqckMErGtdx3+KLL165b4cddiiff/55efXVV8sLL7xQOe/bb79tFkMNCm0Ap6jpp+/HHnuscqmOPVv4ftHEn/wst1auUFWetVMNG9RKQqgNNtigHHbYYY0oZtBKFr/BXXEfXLfIIouUbbbZpipxCAakxDfxLHoObttoo43Kfvvt11hGiL/ggguCRRXwOUTZfTT36dw9CfGN+XKuE9ZJ9YHHY86eDgCq4mSgs802WznggAMqB0Cofkhnv8Ez+SAARmHDDTesB20innANYgZhYtG0bUSU8QSx3Bd07tL+Y448H6qjo36ETjqcxCw8yPyU6BA9BVchTkooD5DdcmbYlnJgLGj0P++885b55puvxyXxNuIZJWJwrkYkberB/bxOZh0ymENDIV0ZRwj4rL766in454bD4822jwOFqk+Uwz0K+eCDDxr/TR3bLOTKICNlkIaznH1VRzkh3aIoDharvsACC/RwRjiJ6JiwZPFBzBwDa+O6/zYZAYHQcVhTD70cEVUJ0bY1WmiIpVCIm9AsEndHMQu4lcUhFFbp6quvrv4UE0FE11lnnbL22muX5ZZbrswxxxw9euqvMjt/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"
            },
            "launch_path": "/chrome"
        }
    },
    "http://www.zeit.de": {
        "origin": "http://www.zeit.de",
        "manifest": {
            "name": "Zeit Online",
            "icons": {
                "48": "data:image/png;base64,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"
            },
            "launch_path": "/index"
        }
    }
};            

    function doList(onsuccess, onerror) {
        navigator.service.ApplicationManager.getInstalledApplications(
            function(apps, count) {
                // Add native apps to the webapp list
                for (var i = 0; i < count; i++) {
                    if (apps[i].name in _demoNativeApps) {
                    var id = "android://" + i;
                    _nativeApps[id] = apps[i];
                    webapps[id] = {
                        origin: id,
                        manifest: {
                            name: apps[i].name,
                            description: apps[i].description,
                            icons: {
                                "48": apps[i].icon
                            }
                        }
                    };
                    }
                }
                if (onsuccess) onsuccess(webapps);
            },
            function(code, message) {
                if (onerror) onerror(message);
            }
        );
    }

    function doLaunch(id, onsuccess, onerror) {
        if (id.substr(0, 10) == "android://") {
            navigator.service.ApplicationManager.launchApplication(
                _nativeApps[id]
            );
            if (onsuccess) onsuccess(true);
        } else {
            var path = webapps[id].manifest.launch_path;
            window.open(webapps[id].origin + (path ? path : "/"));
        }
    }

    function doSaveState(state, onsuccess) {
        _state = state;
        if (onsuccess) onsuccess(true);
    }

    function doLoadState(onsuccess) {
        if (onsuccess) onsuccess(_state);
    }

    return {
        mgmt: {
            list: doList,
            launch: doLaunch,
            saveState: doSaveState,
            loadState: doLoadState
        }
    };
})();
