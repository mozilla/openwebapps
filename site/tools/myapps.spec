%define name myapps
%define version %(cat VERSION)
%define release 1
%define install_conf %{_sysconfdir}/myapps.conf

Summary: myapps.mozillalabs.com server
Name: %{name}
Version: %{version}
Release: %{release}
License: MPL
#Group: Development/Libraries
#BuildRoot: %{_tmppath}/%{pythonname}-%{version}-%{release}-buildroot
Prefix: %{_prefix}
BuildArch: noarch
Vendor: Ian Bicking <ianb@mozilla.com>
#Requires: appsync
Url: https://github.com/mozilla/openwebapps
Source: myapps-%{version}.tar.gz

%description
HTML (shim) implementation of the Open Web Apps repository

%prep
%setup -n %{name}-%{version}

%build
./tools/build_static -H __PROTOCOL__://__DOMAIN__ -a tools/apps.mozillalabs.com %{buildroot}/var/www/static

%pre
install_help () {
    echo "%{install_conf} is a shell script; it should look like:"
    echo "PROTOCOL=https"
    echo "DOMAIN=myapps.mozillalabs.com"
    echo "optionally: NOAPPS=1 (to keep apps.mozillalabs.com from being installed)"
}

if [ ! -e "%{install_conf}" ] ; then
    echo "You must create %{install_conf}"
    install_help
    exit 1
fi

. %{install_conf}
if [ -z "$PROTOCOL" ] ; then
    echo "You did not set PROTOCOL"
    install_help
    exit 1
fi
if [ "$PROTOCOL" != http ] && [ "$PROTOCOL" != https ] ; then
    echo "PROTOCOL is set to '$PROTOCOL': it should be http or https"
    install_help
    exit 1
fi
if [ -z "$DOMAIN" ] ; then
    echo "You did not set DOMAIN"
    install_help
    exit 1
fi

%install

%clean
rm -rf $RPM_BUILD_ROOT

%post
if [ ! -e "%{install_conf}" ] ; then
    exit 1
fi

. %{install_conf}

## This is kind of icky; should use templates?:
sed -i "s/__PROTOCOL__/$PROTOCOL/g; s/__DOMAIN__/$DOMAIN/g" $(find %{_localstatedir}/www/static -name '*.html' -o -name '*.js')
## FIXME: this seems wrong:
if [ ! -z "$NOAPPS" ] ; then
    rm -r %{buildroot}/var/www/static/apps.mozillalabs.com
fi

%files
%defattr(-,root,root)
%{_localstatedir}/www/static

#%dir %{_sysconfdir}/appsync/
