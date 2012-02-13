function doRegisterAppMenu(menuNode) {
  if (menuNode.tagName.toLowerCase() != 'menu') {
      alert("Got tagName " + menuNode.tagName + " - this is surprising");
      return;
  }
  menuNode.style.display = 'none';
  var mainMenu = window.document.getElementById("main_menu");
  var XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
  var commandSet = window.document.getElementById("main_commandset");
  var keySet = window.document.getElementById("main_keyset");

  // Based on http://www.w3.org/TR/html5/commands.html#concept-command
  var cmdCounter = 1;
  function createCommand(sourceNode) {
      var tag = sourceNode.tagName.toLowerCase();
      if (tag == "button") {
          var newMenuItem = window.document.createElementNS(XUL_NS, "menuitem");
          newMenuItem.setAttribute("label", sourceNode.textContent);

          // Apply key shortcuts
          var accessKey = sourceNode.getAttribute("accesskey");
          if (accessKey) {
              var newKey = window.document.createElementNS(XUL_NS, "key");
              newKey.setAttribute("id", "key_" + accessKey);
              newKey.setAttribute("key", accessKey);
              newKey.setAttribute("modifiers", "meta");
              keySet.appendChild(newKey);
              newMenuItem.setAttribute("key", "key_" + accessKey);
          }
          newMenuItem.clickTarget = sourceNode;
          newMenuItem.setAttribute("oncommand", "event.target.clickTarget.click()");
          return newMenuItem;

      } else if (tag == "a") {
          
      } else if (tag == "option") {
          
      } else if (tag == "command") {
          
      } else if (tag == "label") {
          
      }
  }

  function addSeparator(targetPopup) {
      var separator = window.document.createElementNS(XUL_NS, "menuseparator");
      targetPopup.appendChild(separator);            
  }

  // Applies http://www.w3.org/TR/html5/interactive-elements.html#the-menu-element
  // section 4.11.4.2 logic.
  function translateMenuElement(htmlElem, targetPopup) {

      if (htmlElem.tagName.toLowerCase() == "button") {
          var cmd = createCommand(htmlElem);
          targetPopup.appendChild(cmd);
      }
      else if (htmlElem.tagName.toLowerCase() == "hr" ) 
      {
          addSeparator(targetPopup);
      } else if (htmlElem.tagName.toLowerCase() == "option" &&
          item.getAttribute("value") && item.getAttribute("value").length == 0 &&
          item.getAttribute("disabled"))
      {
          addSeparator(targetPopup);
 
      } else if (htmlElem.tagName.toLowerCase() == "li") {
          translateChildren(htmlElem, targetPopup);
      } else if (htmlElem.tagName.toLowerCase() == "label") {
          translateChildren(htmlElem, targetPopup);
      } else if (htmlElem.tagName.toLowerCase() == "menu") {
          if (htmlElem.getAttribute("label")) {
              // Append a submenu to the menu, using the value of the element's label 
              // attribute as the label of the menu. The submenu must be constructed by
              // taking the element and creating a new menu for it using the complete
              // process described in this section.

              var newMenu = window.document.createElementNS(XUL_NS, "menu");
              var newMenuPopup = window.document.createElementNS(XUL_NS, "menupopup");
              newMenu.setAttribute("label", htmlElem.getAttribute("label"));
              newMenu.appendChild(newMenuPopup);
              targetPopup.appendChild(newMenu);
              
              var type = htmlElem.getAttribute("type");
              if (type && type.toLowerCase() == "help") {
                  newMenu.id = "helpMenu";
              }
              translateChildren(htmlElem, newMenuPopup);

          } else {
              // Menu with no label: append separator and then iterate, then another separator
              addSeparator(targetPopup);
              // iterate
              addSeparator(targetPopup);
          }
      } else if (htmlElem.tagName.toLowerCase() == "select") {
          // Select: append separator and then iterate, then another separator
          addSeparator(targetPopup);
          // iterate
          addSeparator(targetPopup);
                                          
      } else if (htmlElem.tagName.toLowerCase() == "optgroup" && item.getAttribute("label")) {
          // Submenu...
      }                        
  }

  function translateChildren(parent, targetElem) {
      var item = parent.firstChild;
      while (item) {
          if (item.nodeType == Node.ELEMENT_NODE) {
              translateMenuElement(item, targetElem);
          }
          item = item.nextSibling;
      }                
  }
  // Remove existing menu items:
  while(mainMenu.firstChild) mainMenu.removeChild(mainMenu.firstChild);
  //while(commandSet.firstChild) commandSet.removeChild(commandSet.firstChild);
 // while (keySet.firstChild) keySet.removeChild(keySet.firstChild);
  
  // And recurse to kick it all off:
  translateChildren(menuNode, mainMenu);
}

