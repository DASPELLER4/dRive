# dRive
A file hosting web application similar to google drive and other such services. Has many features to make the user experience as comfortable as possible.
The software uses mysql to store all the folder structure and user data and file information to keep all data easily accessible and managable by an administrator, with all files being stored in a single folder.

# Setup
Dependencies:
* mysql
* node-js
* npm

```
git clone https://github.com/DASPELLER4/dRive/
cd dRive
python3 -m pip install mysql-connector-python
python3 generateConfig.py
```

Now the server should be set up for use, just run
```
sudo node index.js
```
And your instance of dRive should be up and running!
    
