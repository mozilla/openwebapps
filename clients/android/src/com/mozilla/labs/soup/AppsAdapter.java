package com.mozilla.labs.soup;

import java.util.Iterator;

import org.json.JSONException;
import org.json.JSONObject;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.ListView;
import android.widget.BaseAdapter;
import android.widget.ImageView;
import android.widget.TextView;

public class AppsAdapter extends BaseAdapter implements ListView.OnItemClickListener {
	JSONObject[] apps;
	MainActivity mact;
	
	public AppsAdapter(JSONObject installed, MainActivity ma) {
		mact = ma;
		Iterator<?> itr = installed.keys();
		apps = new JSONObject[installed.length()];
		
		int i = 0;
		while (itr.hasNext()) {
			try {
				apps[i++] = installed.getJSONObject((String) itr.next());
			} catch (JSONException e) {
				// TODO Auto-generated catch block
				e.printStackTrace();
			}
		}
	}
	
	public int getCount() {
		System.out.println("I'm called and I have " + apps.length + " apps!");
		return apps.length;
	}

	public Object getItem(int position) {
		return apps[position];
	}

	public long getItemId(int position) {
		return position;
	}
	
	public Bitmap resizeBitmap(Bitmap bm, int newHeight, int newWidth) {
		int width = bm.getWidth();
		int height = bm.getHeight();
		float scaleWidth = ((float) newWidth) / width;
		float scaleHeight = ((float) newHeight) / height;

		// create a matrix for the manipulation
		Matrix matrix = new Matrix();
		// resize the bit map
		matrix.postScale(scaleWidth, scaleHeight);

		// recreate the new Bitmap
		Bitmap resizedBitmap = Bitmap.createBitmap(bm, 0, 0, width, height, matrix, false);
		return resizedBitmap;
	}

	protected Bitmap getAppIcon(JSONObject app) {
		Bitmap img = BitmapFactory.decodeResource(mact.getResources(), R.drawable.soup);
		try {
			JSONObject icons = app.getJSONObject("icons");
			switch (icons.length()) {
			case 0:
				break;
			case 1:
			default:
				// TODO: more intelligent guess as to which icon to use
				String icon = icons.getString((String) icons.keys().next());
				if (icon.startsWith("data:image/png;base64,")) {
					byte[] data = Base64.decode(icon.substring(22));
					img = BitmapFactory.decodeByteArray(data, 0, data.length);
				}
			}
		} catch (JSONException e) {
			System.out.println("Could not get icon for " + app);
		}
		
		return img;
	}
	
	public View getView(int position, View convertView, ViewGroup parent) {
		View row = convertView;
		if (row == null) {
			LayoutInflater inf = mact.getLayoutInflater();
			row = inf.inflate(R.layout.list_item, null);
		}
		
		JSONObject app = apps[position];
		ImageView icon = (ImageView) row.findViewById(R.id.appIcon);
		TextView title = (TextView) row.findViewById(R.id.appTitle); 
		icon.setImageBitmap(resizeBitmap(getAppIcon(app), 32, 32));
		
		String name = "Nameless App";
		try {
			name = app.getString("name");
		} catch (JSONException e) {
			System.out.println("Could not get name for " + app);
		}
		title.setText(name);
		
		return row;
	}

	public void onItemClick(AdapterView<?> lv, View parent, int position, long id) {
		JSONObject app = apps[position];
		String name = "Nameless App";
		String url = "http://myapps.mozillalabs.com/notfound";
		
		try {
			name = app.getString("name");
			url = app.getString("base_url");
			url += app.getString("launch_path");
		} catch (JSONException e) {
			e.printStackTrace();
		}
		
		mact.addToHomeScreen(name, url, getAppIcon(app));
	}
}
