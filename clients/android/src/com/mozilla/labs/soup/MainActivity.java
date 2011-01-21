package com.mozilla.labs.soup;

import com.mozilla.labs.soup.R;

import android.app.Activity;
import android.app.ProgressDialog;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.View.OnClickListener;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;

public class MainActivity extends Activity implements OnClickListener {
	protected SyncService service;
	protected SharedPreferences prefs;
	
    public MainActivity() {
    	service = new SyncService();
    }
    
    protected void addToHomeScreen(String name, String url, Bitmap icon) {
    	Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        Intent result = new Intent();
        result.putExtra(Intent.EXTRA_SHORTCUT_INTENT, intent);
        result.putExtra(Intent.EXTRA_SHORTCUT_NAME, name);
        result.putExtra(Intent.EXTRA_SHORTCUT_ICON, icon);
        result.setAction("com.android.launcher.action.INSTALL_SHORTCUT");
        sendBroadcast(result);
        Toast.makeText(this, "Installed", Toast.LENGTH_SHORT).show();
    }
    
    protected void addUser(String usr, String pwd, String node) {
		SharedPreferences.Editor ed = prefs.edit();
		ed.putString("username", usr);
		ed.putString("password", pwd);
		ed.putString("cluster", node);
		ed.commit();
	}
    
    protected void showApps(AppsAdapter apd) {
    	setContentView(R.layout.main_page);
    }
    
    protected void getAndShowApps(String uname, String paswd, String node) {
    	String manifest = service.getManifest(uname, paswd, node);
		if (manifest.equals("")) {
			// authentication failed
			Toast.makeText(this, R.string.invalidPassword, Toast.LENGTH_SHORT).show();
			setContentView(R.layout.login_page);
		} else if (manifest.equals("{}")) {
			// empty manifest
			addUser(uname, paswd, node);
			setContentView(R.layout.main_page);
		} else {
			// non empty manifest
			addUser(uname, paswd, node);
			showApps(service.parseManifest(manifest));
		}
    }
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        prefs = getPreferences(MODE_PRIVATE);
        if (prefs.contains("username")) {
        	getAndShowApps(
        		prefs.getString("username", ""),
        		prefs.getString("password", ""),
        		prefs.getString("cluster", "")
        	);
        } else {
        	setContentView(R.layout.login_page);
        	Button login = (Button)findViewById(R.id.loginButton);
        	login.setOnClickListener(this);
        }
    }
    
    public void onClick(View v) {
    	ProgressDialog spin = ProgressDialog.show(this, "", getString(R.string.loginMessage), true);
		String uname = ((EditText)findViewById(R.id.loginID)).getText().toString();
		String paswd = ((EditText)findViewById(R.id.loginPassword)).getText().toString();
		
		String node = service.getCluster(uname);
		spin.dismiss();
		
		if (node.equals("")) {
			Toast.makeText(this, R.string.invalidUser, Toast.LENGTH_SHORT).show();
		} else {
			getAndShowApps(uname, paswd, node);
		}
	}
}

