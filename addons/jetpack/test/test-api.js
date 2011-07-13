const FFRepoImpl = require("api").FFRepoImplService;

var repo;
exports.setup = function() {
    repo = FFRepoImpl;
};

exports.teardown = function() {
    repo = null;
};

