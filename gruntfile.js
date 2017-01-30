const fs = require('fs');

module.exports = function(grunt) 
{
    require('jit-grunt')(grunt, {
        ngtemplates: 'grunt-angular-templates'
    });

    grunt.initConfig({
        /**
         * uglify.
         */
        uglify: {
            options: {
                beautify: false,
                preserveComments: 'some',
                compress: {
                    drop_console: true
                }
            },
            release: {
                files: {
                    'dist/spatial_navigation.min.js': ['src/spatial_navigation.js']
                }
            }
        }
    });

    grunt.registerTask('default', [
        'uglify'
    ]);
};