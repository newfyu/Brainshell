const { defineConfig } = require('@vue/cli-service')
// module.exports = defineConfig({
//   transpileDependencies: true
// })
module.exports = {
  pluginOptions: {
    electronBuilder: {
      nodeIntegration: true,
      externals: ['electron-store'],
      builderOptions: {
        "win": {
          "icon": "public/icon256.png"
        },
        extraResources: [
          {
            from: "/Users/lhan/Projects/BrainDoor/dist/braindoor",
            to: "braindoor"
          }
        ]
      }
    }
  }
}
