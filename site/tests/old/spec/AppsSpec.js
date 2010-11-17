/*
 * To test the myapps-hosted functionality, we embed apps.js in
 * a spec runner that is actually running from a file: URL. 
 * This might cause trouble on platforms that do not support
 * localStorage on file:, or have different behavior in that case.
 * If that becomes an issue, we'll need to host the spec runner
 * through an http server.
 */
describe("apps", function() {

  var apps;
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


  beforeEach(function() {
    apps = new Apps();
  });
  afterEach(function() {
    apps.removeAll();
  });

  function expectToFailInstallation(manifest) {
    expect(apps.install(manifest)).toBeFalsy();
  }


  describe("before any tests are run", function() {
    it("should have no apps installed", function() {
      expect(apps.installs).toBeDefined();
      expect(apps.installs.length).toEqual(0);
    });
  });
  

  //----------------------------------------------------------------------
  // Basic install functionality
  //----------------------------------------------------------------------
  it("should correctly install a simple application", function() {
    apps.install(manifest);
    expect(apps.installs.length).toEqual(1);
    expect(apps.installs[0].app.name).toEqual("Test App");      
  });
  
  it("should replace an existing install with a new one that has the same launch_url", function() {
    apps.install(manifest);
    apps.install(sameLaunchManifest);
    expect(apps.installs.length).toEqual(1);
    expect(apps.installs[0].app.name).toEqual("Some Other App");      
  });

  it("should add another install for the same urls with a different launch_url", function() {
    apps.install(manifest);
    apps.install(differentLaunchManifest);
    expect(apps.installs.length).toEqual(2);
    var names = [apps.installs[0].app.name, apps.installs[1].app.name];
    names.sort();
    expect(names).toEqual(["App Standing Next To The First One", "Test App"]);
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
  });

  //----------------------------------------------------------------------
  // Uninstall
  //----------------------------------------------------------------------
  it("should correctly remove an installed app", function() {
    apps.install(manifest);
    apps.install(differentLaunchManifest);
    expect(apps.installs.length).toEqual(2);
    apps.remove(apps.installs[0]);
    expect(apps.installs.length).toEqual(1);
  });

  //----------------------------------------------------------------------
  // Search through application name and metadata
  //----------------------------------------------------------------------
  it("should correctly search app names", function() {
    apps.install(differentLaunchManifest); // "App Standing Next To The First One"
    apps.install(manifest); // "Test App"
    // will be alpha

    expect(apps.searchApps("test").length).toEqual(1);
    expect(apps.searchApps("test")[0]).toBe(apps.installs[1]);
    expect(apps.searchApps("app").length).toEqual(2);
    expect(apps.searchApps("app")[0]).toBe(apps.installs[0]);// should be alpha
    expect(apps.searchApps("app")[1]).toBe(apps.installs[1]);
    expect(apps.searchApps("standing").length).toEqual(1);
    expect(apps.searchApps("standing")[0]).toBe(apps.installs[0]);
  });

  //----------------------------------------------------------------------
  // Asynchronously pull notifications
  //----------------------------------------------------------------------
  it("should pull app notifications", function() {
    var manifest = {
      name:"Notification App",
      app:{
        urls:["http://localhost:8125"],
        launch: {web_url: "http://localhost:8125/launch"}
      },
      notification: "http://localhost:8125/synthesize_notification"
    };

    var callback = jasmine.createSpy();
    runs(function() {
      apps.refreshNotifications(callback);
    });
    waits(200);
    runs(function() {
      expect(callback.callCount).toEqual(1);
    });
  });
});