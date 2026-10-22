const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withDisableR8(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const gradlePropertiesPath = path.join(cfg.modRequest.platformProjectRoot, 'gradle.properties');
      if (fs.existsSync(gradlePropertiesPath)) {
        let content = fs.readFileSync(gradlePropertiesPath, 'utf8');
        content = content.replace(/android\.enableMinifyInReleaseBuilds=true/g, 'android.enableMinifyInReleaseBuilds=false');
        if (!content.includes('android.enableMinifyInReleaseBuilds')) {
          content += '\nandroid.enableMinifyInReleaseBuilds=false\n';
        }
        fs.writeFileSync(gradlePropertiesPath, content, 'utf8');
      }
      return cfg;
    },
  ]);
};
