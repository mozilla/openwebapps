unsafeWindow.navigator.pushNotifications = (function () {
            var __notifsCallback = function() {};
            alert(this);
            self.port.on('execNotifsCallback', function(msg) {
                if (msg && msg.args)
                    __notifsCallback.apply(window,msg.args);
            });
            return {
                requestPermissions: function requestPermissions(params,callbackFunc) {
                    alert(__notifsCallback);
                    __notifsCallback = callbackFunc;
                    params['contentHost'] = window.location.host;
                    self.postMessage({ params: params });
                }
            }
    })();