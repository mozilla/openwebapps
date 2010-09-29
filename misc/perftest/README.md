# What is this?

This is some exploration around the cost of conduits.  How will they
scale when hundreds of them are loaded into the same page?  Here's are 
some intial questions:

1. How long does it take on an average machine to initialize 100 conduits?
   This includes adding iframes to the dom and establishing communication with them.
2. How long would it take to execute a single query across all of those conduits?


# Running

1. node webserver.js
2. open http://localhost:8888/index.html in your favorite browser
3. play
