/* Taken from greplin.com; investigate licensing terms before release */

var input;

$(function(){
  $("#si").focus();

  $('body').keydown(function(e){
    switch(e.keyCode) { 
    case 40:
      if(!$('.selected').length)
        $('#results > ul > li > ul > li:first').addClass('selected');
      $('.selected').removeClass().next().addClass('selected');
      break;

    case 38:
      if(!$('.selected').length)
        $('#results > ul > li > ul > li:last').addClass('selected');
      $('.selected').removeClass('selected').prev().addClass('selected');
      break;
    }
  });

  $("#light").submit(function(){
    if(!$(".hover").length)
      return false;
    window.open($(".hover").find('a').attr('href'));
    //$("#l").show();
    return false;
  });
  $("#showall").click(function(){
    window.location = '/search?q=' + escape($("#si").val());
    return false;
  });
  $("#results tr").click(function(){
    window.open($("a", this).attr('href'));
    return false;
  });


  /*	$(".hover").live('mouseenter', function(){
    $(this).removeClass('hover');
  });
  */
  $("#si").keyup(function(){
    input = $(this).val().trim();
    if(input === linput)
      return;
    if(input == '') {
      $("#results").hide();
      $(".gallery_screen_container").hide();
      $("#no_results").hide();
      ajax_request.abort();
      return;
    }
    $("#showall").show();
    clearTimeout(timer);
    ajax_request.abort();
    timer = setTimeout("spotlight()", 400);
    linput = input;

  });

});

var timer;
var linput;
var cycle=0;
var ajax_request = {abort: function(){return null;}}

/*
var GreplinPlugin = {
  app: {
    name: "Greplin"
  },
  search: function(term, callback) {
    var categoryLookup = {
      4: "Email",
      5: "Updates",
      11: "Contacts"
    };
    var req = XMLHttpRequest();
    req.open("GET", "https://www.greplin.com/ajax/spotlight?format=json&q=" + term, true);
    req.onreadystatechange = function (aEvt) {  
      if (req.readyState == 4) {  
         if(req.status == 200) {
          try {
            var result = JSON.parse(req.responseText);
            // convert to dashboard search result
            var toDash = [];
            for (var i=0;i<result.results.length;i++) {
              var key = result.results[i];
              if (key == "top") continue; // ignore for the moment
              var serviceResults = result.results[key];
              for (var j=0;j<serviceResults.results.length;j++) {
                var item = serviceResults.results[j];
                var newItem = {
                  "title": item.title,
                  "category_term": categoryLookup[item.entity_type],
                  "link": item.url,
                  "summary": content.join(" - ")
                }
                toDash.push(newItem);
              }
            }
            callback( {title:"Greplin Results", results: toDash} );
          } catch (e) {
            alert("Error in Greplin plugin: " + e);
          }
        } else {
        // TODO report error somehow....
          alert("Error in Greplin plugin: " + e);
        }
      }
    }
    req.send(null);
  }
}
var gPlugins = [GreplinPlugin];
*/

function SearchResult()
{
  this.resultMap = {}
}
SearchResult.prototype = {
  addResults: function(install, appResults) 
  {
    try {
      dump("adding results for " + install.app.name + " to full result set\n");
      var parsed = JSON.parse(appResults)
      if (parsed.results)
      {
        var i;
        for (i=0;i<parsed.results.length;i++)
        {
          var res = parsed.results[i];
          if (!res.app) res.app = install.app;
          var cat = res.category_term ? res.category_term : "Result";
          if (!this.resultMap[cat]) this.resultMap[cat] = [];
          this.resultMap[cat].push(res);
        }
      }
    } catch (e) {
      alert(e);
    }
    try {
      $("#loading_results").hide(); // TODO track whether we have more work inflight
      this.render();
    } catch (e) {
      alert(e);
    }
    // TODO sort categories that changed
  },
  render: function() {
    var categories = ["<ul>"];
    var key;
    for (key in this.resultMap)
    {
      var categoryItems = ["<li><div class='searchCat'>" + key + "</div>", "<ul>"];
      for (var i=0;i<this.resultMap[key].length;i++)
      {
        var item = this.resultMap[key][i];
        var icon = item.app.icons["48"];
        categoryItems.push("<li><div class='searchHead'><img src='" + icon + 
          "' width='16' height='16'><div class='searchTitle'><a target=\"_blank\" href=\"" +  item.link + 
          "\">" + item.title + "</a></div></div><div class='searchSumm'>" + item.summary +
           "</div></li>");
      }
      categoryItems.push("</ul></li>");
      categories.push(categoryItems.join(""));
    }
    categories.push("</ul>");
    $("#results").html(categories.join("")).show();
  }
}


function makeSearchComplete(install, fullResults) {
  dump("returning searchComplete for " + install.app.name + "\n");
  return function(appResults) {
    var target = install;
    dump("Got results for " + target.app.name + " - " + JSON.stringify(appResults) + "\n");
    fullResults.addResults(target, appResults);
  }
}

var conduits = null;

var spotlight = function() {
  // searches could be handled natively if the target supports cross-origin XHR 
  // and we have an access token.  since we don't have a way to do that yet,
  // we require extension support.
  function searchComplete(result)
  {
    $("#loading_results").hide();
    $("#results").html("Hey, the search finished.  Result is " + result).show();
    $("#top").parent().addClass('hover');
  }
  
  $("#loading_results").show();
  
  var fullResults = new SearchResult();
  var any = false;
  for (var i=0;i<gApps.installs.length;i++)
  {
    try {
      var install = gApps.installs[i];
      if (install.conduit && install.app.supportedAPIs.indexOf("search") >= 0)
      {
        any = true;
        dump("starting search for " + install.app.name + "\n");
        install.conduit.search(escape(input), makeSearchComplete(install, fullResults));
      }
    } catch (e) {
      alert("ERROR: " + e + "\n" + e.stack);
    }
  }
  
/*  // And then do plugins
  for (var i=0;i<gPlugins.length;i++)
  {
    try {
      var plugin = gPlugins[i];
      if (plugin.search)
      {
        function makePluginComplete(plugin, fullResults) {
          return function(pluginResults) {
            fullResults.addResults(plugin, pluginResults);
          }
        }
        any = true;
        plugin.search(escape(input), makePluginComplete (plugin, fullResults));
      }
    } catch(e) {
      alert("ERROR in plugin " + plugin.name + ": " + e + "\n" + e.stack);
    }
  }
  */
  
  if (!any) {
    $("#results").html("Sorry, none of your apps support search.").show();
  }

/*
  ajax_request = $.ajax({
    type: "GET",
    url: "https://www.greplin.com/ajax/spotlight",
    data: "q="+escape(input)+"&fq=0",
    success: function(data){
      $("#loading_results").hide();
      if(!data['results']) {
        $("#results").hide();
        $(".gallery_screen_container").hide();
        $("#no_results").show();
        $(".gallery_screen_container").eq(cycle).show();
        cycle = (cycle > 2) ? 0 : cycle+1;
      }
      else 
      {
        $("#results").html(data['results']).show();
        $("#top").parent().addClass('hover');
      }
    }
  });*/
  
};