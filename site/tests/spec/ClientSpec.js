/**
* Remember, the client runs on localhost:8123, the server runs on localhost:8124.
* Your should run ClientSpecRunner on 8123.
*
*/
describe("Client", function() {
  var firstTestDelay = 200; // seems to work on my MB pro
  var laterTestDelay = 50;


  var manifest = {
    name:"Test App",
    app:{
      urls:["http://localhost:8123"],
      launch: {web_url: "http://localhost:8123/launch"}
    }
  };
  var sameLaunchManifest = {
    name:"Some Other App",
    app:{
      urls:["http://localhost:8123"],
      launch: {web_url: "http://localhost:8123/launch"}
    }
  };
  var differentLaunchManifest = {
    name:"App Standing Next To The First One",
    app:{
      urls:["http://localhost:8123"],
      launch: {web_url: "http://localhost:8123/otherLaunch"}
    }
  };

  
  function expectToFailInstallation(manifest) {
    var callback = jasmine.createSpy("'checking for installation failure'");
    runs(function() {
      AppClient.install({manifest:manifest, callback:callback});
    });
    waits(laterTestDelay);
    runs(function() {
      expect(callback).not.toHaveBeenCalled();
      return 
    });
  }

  //----------------------------------------------------------------------
  // Smoke test for simple install
  //----------------------------------------------------------------------
  it("should correctly install a simple application", function() {
    var callback = jasmine.createSpy();

    // set a flag causing trusted.js to automatically dismiss prompt
    runs(function() {
      // set a global which causes installation to occur automatically
      AppClient.install({manifest:manifest, callback:callback});
      // hokey hack.  given that we're on the same domain as trusted.js, we can
      // reach in to flip a flag that will cause dialogs to autodismiss
      document.getElementById("myappsTrustedIFrame").contentWindow.window.AUTODISMISS = true;
    });

    waits(firstTestDelay);

    runs(function() {
      expect(callback).toHaveBeenCalled();
      callback = jasmine.createSpy("'getInstalled callback'");
      AppClient.getInstalled({callback:callback});
    });

    waits(laterTestDelay);

    runs(function() {
      expect(callback).toHaveBeenCalled();

      var result = callback.mostRecentCall.args;
      expect(result[0].installed.length).toEqual(1);
      var app = result[0].installed[0];
      expect(app.name).toEqual("Test App");      
    });
  });
  
  it("should replace an existing install with a new one that has the same launch_url", function() {
    var callback = jasmine.createSpy();
    runs(function() {
      AppClient.install({manifest:sameLaunchManifest, callback:callback});
    });
    waits(firstTestDelay);
    runs(function() {
      expect(callback).toHaveBeenCalled();
      AppClient.getInstalled({callback:callback});
    });
    waits(laterTestDelay);
    runs(function() {
      expect(callback).toHaveBeenCalled();
      var result = callback.mostRecentCall.args;
      expect(result[0].installed.length).toEqual(1);
      var app = result[0].installed[0];
      expect(app.name).toEqual("Some Other App");      
    });
  });

  it("should add another install for the same urls with a different launch_url", function() {
    var callback = jasmine.createSpy();
    runs(function() {
      AppClient.install({manifest:differentLaunchManifest, callback:callback});
    });
    waits(firstTestDelay);
    runs(function() {
      expect(callback).toHaveBeenCalled();
      AppClient.getInstalled({callback:callback});
    });
    waits(laterTestDelay);
    runs(function() {
      expect(callback).toHaveBeenCalled();
      var result = callback.mostRecentCall.args;
      var installed = result[0].installed;
      expect(installed.length).toEqual(2);
      var names = [installed[0].name, installed[1].name];
      names.sort();
      expect(names).toEqual(["App Standing Next To The First One", "Some Other App"]);
    });
  });


  //----------------------------------------------------------------------
  // Test Install Validation
  //----------------------------------------------------------------------
  describe("should not install an app", function() {
    it("with no name", function() {
      var badManifest = JSON.parse(JSON.stringify(manifest));
      delete badManifest.name;
      expectToFailInstallation(badManifest);
    });

    it("with no app", function() {
      var badManifest = JSON.parse(JSON.stringify(manifest));
      delete badManifest.app;
      expectToFailInstallation(badManifest);
    });
    
    it("with no app.urls", function() {
      var badManifest = JSON.parse(JSON.stringify(manifest));
      delete badManifest.app.urls;
      expectToFailInstallation(badManifest);
    });
    it("with no app.launch", function() {
      var badManifest = JSON.parse(JSON.stringify(manifest));
      delete badManifest.app.launch;
      expectToFailInstallation(badManifest);
    });
    it("with no app.launch.web_url", function() {
      var badManifest = JSON.parse(JSON.stringify(manifest));
      delete badManifest.app.launch.web_url;
      expectToFailInstallation(badManifest);
    });
    it("with a launch web_url that isn't part of urls", function() {
      var badManifest = JSON.parse(JSON.stringify(manifest));
      badManifest.app.launch.web_url = "http://baddomain.com";
      expectToFailInstallation(badManifest);
    });
  });


});
