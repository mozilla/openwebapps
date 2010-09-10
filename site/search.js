/* Taken from greplin.com; investigate licensing terms before release */

var input;
(function( $ ) {
		$.widget( "ui.combobox", {
			_create: function() {
				var self = this;
				var select = this.element.hide(),
					selected = select.children( ":selected" ),
					value = selected.val() ? selected.text() : "";
				var input = $( "<input>" )
					.insertAfter( select )
					.val( value )
					.autocomplete({
						delay: 0,
						minLength: 0,
						source: function( request, response ) {
							var matcher = new RegExp( $.ui.autocomplete.escapeRegex(request.term), "i" );
							response( select.children( "option" ).map(function() {
								var text = $( this ).text();
								if ( this.value && ( !request.term || matcher.test(text) ) )
									return {
										label: text.replace(
											new RegExp(
												"(?![^&;]+;)(?!<[^<>]*)(" +
												$.ui.autocomplete.escapeRegex(request.term) +
												")(?![^<>]*>)(?![^&;]+;)", "gi"
											), "<strong>$1</strong>" ),
										value: text,
										option: this
									};
							}) );
						},
						select: function( event, ui ) {
							ui.item.option.selected = true;
							//select.val( ui.item.option.value );
							self._trigger( "selected", event, {
								item: ui.item.option
							});
							setTimeout('$("#si").focus();spotlight();', 200);
							$("#index_icon").attr('src','/img/indexes/icon/' + $("#fq_selector option:selected").attr('name') + '.png');
					
						},
						change: function( event, ui ) {
							if ( !ui.item ) {
								var matcher = new RegExp( "^" + $.ui.autocomplete.escapeRegex( $(this).val() ) + "$", "i" ),
									valid = false;
								select.children( "option" ).each(function() {
									if ( this.value.match( matcher ) ) {
										this.selected = valid = true;
										return false;
									}
								});
								if ( !valid ) {
									// remove invalid value, as it didn't match anything
									$( this ).val( "" );
									select.val( "" );
									return false;
								}
							}
						}
					})
					.addClass( "ui-widget ui-widget-content ui-corner-left" );

				input.data( "autocomplete" )._renderItem = function( ul, item ) {
					return $( "<li></li>" )
						.data( "item.autocomplete", item )
						//.append( "<a> <img src='/img/indexes/icon/" + item.option.attributes[1].nodeValue + ".png' class='comboicon'>" + item.label + "</a>" )
						.append( "<a>" + item.label + "</a>" )
						.appendTo( ul );
				};

				$( "<button>&nbsp;</button>" )
					.attr( "tabIndex", -1 )
					.attr( "title", "Show All Items" )
					.insertAfter( input )
					.addClass('ui-autocomplete-button')
					.click(function() {
						// close if already visible
						if ( input.autocomplete( "widget" ).is( ":visible" ) ) {
							input.autocomplete( "close" );
						}

						// pass empty string as value to search for, displaying all results
						input.autocomplete( "search", "" );
						input.focus();
					return false;
					});
			}
		});
	})(jQuery);

	
$(function(){
	$("#fq_selector").combobox();
	$("#si").focus();
	$('body').keydown(function(e){
		switch(e.keyCode) { 
		case 40:
			if(!$('.hover').length)
         		$('#results td:first').parent().addClass('hover');
            $('.hover').removeClass().next().addClass('hover');
         break;
         case 38:
         	if(!$('.hover').length)
         		$('#results td:last').parent().addClass('hover');
           	$('.hover').removeClass('hover').prev().addClass('hover');
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
	$(".hover").live('mouseenter', function(){
		$(this).removeClass('hover');
	});
	
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
          res.app = install.app;
          var cat = res.category_term ? res.category_term : "Result";
          if (!this.resultMap[cat]) this.resultMap[cat] = [];
          this.resultMap[cat].push(res);
        }
      }
    } catch (e) {
      alert(e);
    }
    try {
      this.render();
    } catch (e) {
      alert(e);
    }
    // TODO sort categories that changed
  },
  render: function() {
    dump("Rendering\n");
    var categories = ["<ul>"];
    var key;
    for (key in this.resultMap)
    {
      var categoryItems = ["<li><div class='searchCat'>" + key + "</div>", "<ul>"];
      for (var i=0;i<this.resultMap[key].length;i++)
      {
        var item = this.resultMap[key][i];
        var icon = item.app.icons["48"];
        dump("Got icon for search result: " + icon + " - item.app.icons is " + JSON.stringify(item.app.icons));
        categoryItems.push("<li><div class='searchHead'><img src='" + icon + "' width='16' height='16'><a href=\"" +  item.link + "\">" + item.title + "</a></div><div class='searchSumm'>" + item.summary + "</div></li>");
      }
      categoryItems.push("</ul></li>");
      categories.push(categoryItems.join(""));
    }
    categories.push("</ul>");
    dump("new HTML is " + categories.join("") + "\n");
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
  
  if (!navigator.apps || !navigator.apps.searchApp)
  {
    $("#results").html("Sorry, your browser doesn't support search.  Please <a href='#'>install an extension</a> to enable it.").show();
    return;
  }
  
  $("#loading_results").show();
  
  // If we haven't created conduits yet, go do that now
  if (!conduits) {
    conduits = {};
    for (var i=0;i<gApps.installs.length;i++)
    {
      var install = gApps.installs[i];
      if (install.app.conduit)
      {
        var key = install.app.app.launch.web_url;
        var conduit = new AppConduit(key, install.app.conduit);
        conduits[key] = conduit;
      }
    }
  }
  
  var fullResults = new SearchResult();
  var any = false;
  for (var i=0;i<gApps.installs.length;i++)
  {
    try {
      var install = gApps.installs[i];
      if (install.app.conduit && install.app.supportedAPIs.indexOf("search") >= 0)
      {
        any = true;
        dump("starting search for " + install.app.name + "\n");
        conduits[install.app.app.launch.web_url].search(escape(input), makeSearchComplete(install, fullResults));
      }
    } catch (e) {
      alert("ERROR: " + e + "\n" + e.stack);
    }
  }
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