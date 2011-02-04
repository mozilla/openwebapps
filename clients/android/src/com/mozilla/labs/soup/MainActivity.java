package com.mozilla.labs.soup;

import com.mozilla.labs.soup.R;

import android.app.Activity;
import android.app.ProgressDialog;
import android.net.Uri;
import android.os.AsyncTask;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.view.View.OnClickListener;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ListView;
//import android.widget.TextView;
import android.widget.Toast;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;

public class MainActivity extends Activity implements OnClickListener {
	protected SyncService service;
	protected ProgressDialog spin;
	protected SharedPreferences prefs;
	
    public MainActivity() {
    	service = new SyncService(this);
    }
    
    protected void addToHomeScreen(String name, String url, Bitmap icon) {
    	Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        Intent result = new Intent();
        result.putExtra(Intent.EXTRA_SHORTCUT_INTENT, intent);
        result.putExtra(Intent.EXTRA_SHORTCUT_NAME, name);
        result.putExtra(Intent.EXTRA_SHORTCUT_ICON, icon);
        result.setAction("com.android.launcher.action.INSTALL_SHORTCUT");
        sendBroadcast(result);
        Toast.makeText(this, "Installed " + name, Toast.LENGTH_SHORT).show();
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
    	ListView lv = (ListView) findViewById(R.id.appList);
    	//TextView tv = (TextView) findViewById(R.id.mainViewLabel);
    	//tv.setText(getString(R.string.mainMsg));
    	lv.setAdapter(apd);
    	lv.setOnItemClickListener(apd);
    }
    
    protected void showLogin() {
    	setContentView(R.layout.login_page);
    	Button login = (Button)findViewById(R.id.loginButton);
    	login.setOnClickListener(this);
    }
    
    protected void getAndShowApps(String uname, String paswd, String node) {
    	String manifest = service.getManifest(uname, paswd, node);

		if (manifest.equals("")) {
			// authentication failed
			Toast.makeText(this, R.string.invalidPassword, Toast.LENGTH_SHORT).show();
			setContentView(R.layout.login_page);
		} else if (manifest.equals("{}")) {
			// empty manifest
			System.out.println("Uh oh the manifest was empty!");
			addUser(uname, paswd, node);
			setContentView(R.layout.main_page);
		} else {
			// non empty manifest
			System.out.println("Got a bunch of apps but let's see if JSON is valid");
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
        	showLogin();
        }
    }
    
    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
    	menu.add(getString(R.string.logout));
    	return super.onCreateOptionsMenu(menu);
    }
    
    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
    	SharedPreferences.Editor ed = prefs.edit();
		ed.clear();
		ed.commit();
		showLogin();
    	return super.onContextItemSelected(item);
    }
    
    public void onClick(View v) {
    	// Hide keyboard
    	InputMethodManager mgr = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
    	mgr.hideSoftInputFromWindow(v.getWindowToken(), 0);
    	
    	// This is SO much more uglier than it has to be
    	// But we do it so as to avoid blocking the UI thread
    	class FetchAppsTask extends AsyncTask<Void, Void, String[]> {
    		
    		// Worker thread
    		protected String[] doInBackground(Void... params) {
    			String uname = ((EditText)findViewById(R.id.loginID)).getText().toString();
    			String paswd = ((EditText)findViewById(R.id.loginPassword)).getText().toString();
    			String node = service.getCluster(uname);
    			
    			if (node.equals("")) {
    				return null;
    			} else {
    				String[] user = {uname, paswd, node};
    				return user;
    			}
    		}
    		
    		// You can only access the UI thread here
    		protected void onPostExecute(String[] result) {
    			spin.dismiss();
    			if (result == null) {
    				Toast.makeText(MainActivity.this, R.string.invalidUser, Toast.LENGTH_SHORT).show();
    			} else {
    				getAndShowApps(result[0], result[1], result[2]);
    			}
    		}
    	}
    	
    	spin = ProgressDialog.show(this, "", getString(R.string.loginMessage), true);
    	new FetchAppsTask().execute();
	}
}

