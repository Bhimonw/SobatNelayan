
module.exports = {
    plugins: [
        // Use the Tailwind PostCSS adapter required by this Tailwind version.
        require('@tailwindcss/postcss')(),
        require('autoprefixer')(),
    ],
}