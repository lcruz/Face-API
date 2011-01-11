from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app
from google.appengine.ext import db
from google.appengine.ext.webapp import template
import os

class MainPage(webapp.RequestHandler):

    def get(self):        
        path = os.path.join(os.path.dirname(__file__), 'index.html')
        self.response.out.write(template.render(path, {}))

class Upload(webapp.RequestHandler):
    
    def get(self):
        self.post()
        
    def post(self):
        imagefile = ImageFile() 
        imagefile.filedata = db.Blob(self.request.body.decode('hex'))
        imagefile.filename = self.request.get('filename') 
        imagefile.put() 
        self.response.out.write('Archivo subido')

class GetImage(webapp.RequestHandler):
    def get(self):
        filename = self.request.get('filename')
        
        image = readImage(filename)

        if (image and image.filedata):
             self.response.headers['Content-Type'] = 'image/jpeg'
             self.response.out.write(image.filedata)
        else:
            self.redirect('/static/noimage.jpg')

def readImage(filename):
    images =  ImageFile.gql("WHERE filename = :1", filename)
    return images[0]

class ImageFile(db.Model): 
    code = db.StringProperty(multiline=False) 
    filedata = db.BlobProperty(default=None)
    filename = db.StringProperty(multiline=False) 
    date = db.DateTimeProperty(auto_now_add=True) 


application = webapp.WSGIApplication([
    ('/', MainPage),
    ('/view', GetImage),
    ('/upload', Upload),
], debug=True)


def main():
    run_wsgi_app(application)

if __name__ == "__main__":
    main()
