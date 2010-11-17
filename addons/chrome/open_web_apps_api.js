// a script that is inserted into the execution context of
// webpage.  his goal in life is to shim navigator.apps.
// to expose the OpenWebApps API and relay calls into trusted
// code.
if (!navigator.apps) {
    console.log("injecting navigator.apps API");
    navigator.apps = {
        getInstalled:function () {
            console.log("getInstalled called");
        },
        getInstalledBy:function () {
            console.log("getInstalledBy called");
        },
        install:function () {
            console.log("install called");
        },
        setRepoOrigin: function () {
            console.log("WARNING: navigator.apps.setRepoOrigin is meaningless when the openwebapps extension is installed");
        },
        verify: function () {
            console.log("verify called");
        },
        mgmt: {
            list: function () {
                console.log("mgmt.list called");
            },
            remove: function () {
                console.log("mgmt.remove called");
            }
        }
    };
}
