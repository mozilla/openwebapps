This is a chrome extension which provides browser support for
Mozilla's Open Web Apps specification.  

Source code organization is thus:

**`copy_shared_libs.sh`** - a script to copy in shared js libs (chrome hates
                      symlinks)
**`img/`** - image resources
**`jslibs/`** - shared javascript libraries copied in, never checked into source 
**`src/`** - chrome specific extension code.
