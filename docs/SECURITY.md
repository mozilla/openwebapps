### Security and Privacy Considerations

Here we present some of our analysis of the possible security and privacy attacks on this system, and the countermeasures we can take against them.

#### Attacks on applications following installation

Once the application manifest has been installed on a user's computer, an attacker may try to tamper with the manifest in order to manipulate the user.  These attacks include:

  * **Tampering with the application manifest in local storage:** If the attacker is able compromise a web-based dashboard, or gain file system access through a different attack vector, they may be able to tamper with the application manifest.  (Note that if the attacker has access to the file system, they can probably replace the web browser, so this consideration may be theoretical).  This kind of tampering can be detected by using tamper-evident signatures, e.g. through digital signatures.  For more on this approach, see wiki:Manifests#Signatures.  Any manifest that extends higher API privileges to an application should be subject to some sort of verification.

  * **Interception of the user during application launch:** If the attacker is able to intercept the user during the launch of an application (e.g. through man-in-the-middle), they could construct a phishing site that appears to be an application store and attempt to steal the user's credentials.  This is identical to the problem faced by many federated login providers in systems like OpenID.  Existing systems to detect and block malware sites can help with this problem, which is not unique to the web application use case.

#### Attacks on the HTML5 repository and dashboard

The prototype dashboard deployed at `myapps.mozillalabs.com` could be an attack vector if an attacker could succesfully impersonate the server providing the dashboard code, e.g. with a man-in-the-middle attack.  The attacker could read the set of installed applications, install deviously constructed application manifests, or vandalize the current set of applications.  The attacker could not steal the user's credentials with the store or the application, since those are not present in the manifest or the installation record.

Countermeasures for this threat include requiring HTTPS for all interaction with the dashboard server, to make sure the origin of the dashboard and repository code is trusted.

If a serious effort is made to support a cross-browser HTML5 dashboard, issues of governance, version control, and operational security will need to be jointly addressed by stakeholders.  An existing technical coordination group could take on the job, or a new independent organization could be created and jointly funded by the browser makers.

If, on the other hand, application repositories are going to live entirely in browser-private storage, the HTML5 dashboard becomes less important and is an uninteresting attack target.

#### Attacks on the verification flow

An attacker may attempt to capture the verification token from a store to a web app to re-use it or attempt to recover the private key of the store.  Stores are encouraged to use a non-replayable verification token, and to ensure that the token does not allow an attacker to escalate their access by claiming to be another user, or to verify a different application.  The use of digital signatures in the verification token is encouraged.

#### Reuse or compromise of application store accounts

Users may accidentally, unknowingly, or maliciously share logins to an application store.  Application stores are free to implement whatever sort of login counters they wish to detect this behavior, and are free to interrupt the verification flow to indicate to users that there appear to be multiple uses of an account.  Note that if a store implements offline verification tokens, they will need their verification page to check back with the store periodically to determine whether an account compromise has been detected.

#### Convincing the user to install bad applications

A malicious site, directory, or store could attempt to convince a user to install an application that abused the user's confidence in some way.  The most serious attacks would involve accessing the privileged APIs of the browser, and, as noted above, should require some sort of verification and a trusted source.  Less serious, but still potentially troubling, attacks could involve manipulating the identity token provided by a store to enable cross-domain tracking of the user.  The countermeasures for this class of attack are essentially identical to those required for browser add-ons and downloads: tracking of malware sites, strongly-worded user warnings, and the ability to return the system to a previously-saved state.

When installing from a malicious site, an HTML repository that depends on iframes for the installation flow could be vulnerable to an iframe defacement attack.  This attack could partially obscure the confirmation dialog to hide the true nature of the application being installed.  A native application repository would not have this problem; also, work on secure user interfaces for HTML content, which could mitigate iframe defacement attacks, is ongoing.  A repository that did not use iframes for the confirmation flow would not be vulnerable to this attack.
