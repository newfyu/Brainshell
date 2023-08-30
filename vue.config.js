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
        "asar": false,
        "appId": "com.tianshu.app",
        "win": {
          "icon": "public/icon256.png",
          extraResources: [
            {
              from: "/Users/lhan/Projects/Braindoor/extra_files/braindoor_win",
              to: "braindoor"
            }
          ]
        },
        "publish": [
          {
            "provider": "github",
            "repo": "https://github.com/newfyu/OpenCopilot",
            "owner": "lhan"
          }
        ],
        extraResources: [
          {
            from: "/Users/lhan/Projects/BrainDoor/dist/braindoor",
            to: "braindoor"
          }
        ]
      }
    }
  },
}
