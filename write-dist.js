const fs = require('fs')
const path = require('path')
const pull = require('pull-stream')
const rimraf = require("rimraf")
const workboxBuild = require('workbox-build');

var html = fs.readFileSync("browser.html", 'utf-8')

function copyToDist(line, type, match) {
  var filepath = match[1]
  var filename = path.basename(filepath)
  fs.copyFileSync(filepath, path.join('dist', type, filename))
  return line.replace(filepath, path.join(type, filename))
}

function generateOfflineCache() {
  workboxBuild.generateSW({
    importWorkboxFrom: 'local',
    skipWaiting: true,
    maximumFileSizeToCacheInBytes: 10000000,
    swDest: './dist/sw.js',
    globDirectory: './dist',
    globPatterns: ['**/*.{ttf,js,css,html}']
  })
}

rimraf("dist", function () {
  fs.mkdirSync('dist')
  fs.mkdirSync('dist/css')
  fs.mkdirSync('dist/js')
  fs.mkdirSync('dist/assets')

  // other
  fs.copyFileSync('css/NotoColorEmoji.ttf', 'dist/css/NotoColorEmoji.ttf')
  fs.copyFileSync('css/TT2020StyleB-Regular.ttf', 'dist/css/TT2020StyleB-Regular.ttf')
  fs.copyFileSync('css/SilverbladeDecorative.ttf', 'dist/css/SilverbladeDecorative.ttf')
  fs.copyFileSync('manifest.json', 'dist/manifest.json')
  fs.copyFileSync('hermies.png', 'dist/hermies.png')
  fs.copyFileSync('favicon.ico', 'dist/favicon.ico')
  fs.copyFileSync('assets/noavatar.svg', 'dist/assets/noavatar.svg')
  fs.copyFileSync('assets/openclipart-1392738806.svg', 'dist/assets/openclipart-1392738806.svg')
  fs.copyFileSync('assets/openclipart-261618.svg', 'dist/assets/openclipart-261618.svg')
  fs.copyFileSync('assets/openclipart-223534.svg', 'dist/assets/openclipart-223534.svg')
  fs.copyFileSync('assets/seabed-155896303267m-optimized.jpg', 'dist/assets/seabed-155896303267m-optimized.jpg')
  fs.copyFileSync('assets/old-barn-wood-background-recolored-2-tiled.jpg', 'dist/assets/old-barn-wood-background-recolored-2-tiled.jpg')

  pull(
    pull.values(html.split('\n')),
    pull.map(line => {
      var script = line.match(/<script src="(.*?)"/)
      var css = line.match(/text\/css\" href="(.*?)"/)
      if (script)
	return copyToDist(line, 'js', script)
      else if (css)
	return copyToDist(line, 'css', css)
      else
	return line
    }),
    pull.collect((err, lines) => {
      fs.writeFileSync('dist/index.html', lines.join('\n'))

      generateOfflineCache()
    })
  )
})
