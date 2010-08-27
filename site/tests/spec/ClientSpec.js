/**
* Remember, the client runs on localhost:8123, the server runs on localhost:8124.
* Your should run ClientSpecRunner on 8123.
*
*/
describe("Client", function() {
  var firstTestDelay = 200; // seems to work on my MB pro
  var laterTestDelay = 50;
  
  function expectToFailInstallation(manifest) {
    var callback = jasmine.createSpy();
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

    runs(function() {
      var manifest = {
        name:"Test App",
        app:{
          urls:["http://localhost:8123"],
          launch: {web_url: "http://localhost:8123/launch"}
        }
      };
      AppClient.install({manifest:manifest, callback:callback});
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
    return;
    var callback = jasmine.createSpy();
    runs(function() {
      var manifest = {
        name:"Some Other App",
        app:{
          urls:["http://localhost:8123"],
          launch: {web_url: "http://localhost:8123/launch"}
        }
      };
      AppClient.install({manifest:manifest, callback:callback});
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
    return;
    var callback = jasmine.createSpy();
    runs(function() {
      var manifest = {
        name:"App Standing Next To The First One",
        app:{
          urls:["http://localhost:8123"],
          launch: {web_url: "http://localhost:8123/otherLaunch"}
        }
      };
      AppClient.install({manifest:manifest, callback:callback});
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
    return;
    it("with no name", function() {
      var manifest = {
        app:{
          urls:["http://localhost:8123"],
          launch: {web_url: "http://localhost:8123/launch"}
        }
      };
      expectToFailInstallation(manifest);
    });

    it("with no app", function() {
      return;
      var manifest = {
        name: "Test App",
      };
      expectToFailInstallation(manifest);
    });
    
    it("with no app.urls", function() {
      return;
      var manifest = {
        name: "Test App",
        app:{
          launch: {web_url: "http://localhost:8123/launch"}
        }
      };
      expectToFailInstallation(manifest);
    });
    it("with no app.launch", function() {
      return;
      var manifest = {
        name: "Test App",
        app:{
          urls:["http://localhost:8123"],
        }
      };
      expectToFailInstallation(manifest);
    });
  });


});
