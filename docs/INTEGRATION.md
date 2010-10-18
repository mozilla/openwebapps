### Integration With the Dashboard and Between Applications

While the initial focus of this proposal remains on the minimal set of components required to enable Open Web Applications, there are opportunities in the future to deepen the level of integration between applications and the dashboard (or browser if native support for applications is present).  The types of user experiences that could be enabled include:

* An aggregated view of outstanding notifications across all of the user's installed applications.

* The ability for the user execute a search across all of the information stored inside their applications.

* Applications to expose "bookmarklet" like functionality, which would cause the browser to include application actions in contextual menus.

* A *service discovery* function, which would allow an application to issue a "please find me the user's X" request &mdash; where X could be contacts, photos, updates, favorite movies, or what have you.  This capability is a necessary piece of many emerging web proposals, including the <a href="http://www.oexchange.org/">OExchange</a> and <a href="http://berjon.com/blog/2010/09/dap.html">Powerbox</a> proposals for cross-site user experience integration.

In addition to applications exposing capabilities to the browser, it would also be possible for applications to expose capabilities to each other.  This feature could allow applications to publish and consume content from each other in secure interactions which are moderated by the repository, and controlled by the user.

The technical support for these types of interactions is already present in modern web browsers in the form of cross document messaging.  The preliminary work that must occur before such features can be considered for inclusion in the specification of Open Web Applications is the development of a framework by which robust versioned APIs can be built on top of HTML5's cross document messaging facilities.  We've begun to explore these first challenges in a parallel experiement, [JSChannel](http://github.com/mozilla/jschannel).
