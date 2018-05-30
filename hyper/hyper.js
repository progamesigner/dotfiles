module.exports = {
    config: {
        fontSize: 18,
        fontFamily: '"Source Code Pro", monospace',
        cursorBlink: true,
        cursorColor: '#c0c5ce',
        cursorShape: 'BEAM',
        foregroundColor: '#c0c5ce',
        backgroundColor: '#2b303b',
        borderColor: '#2b303b',
        padding: '4px 0 4px 8px',
        windowSize: [880, 600],
        colors: {
            black: '#2b303b',
            red: '#bf616a',
            green: '#a3be8c',
            yellow: '#ebcb8b',
            blue: '#8fa1b3',
            magenta: '#b48ead',
            cyan: '#96b5b4',
            white: '#c0c5ce',
            lightBlack: '#65737e',
            lightRed: '#d08770',
            lightGreen: '#343d46',
            lightYellow: '#4f5b66',
            lightBlue: '#a7adba',
            lightMagenta: '#dfe1e8',
            lightCyan: '#ab7967',
            lightWhite: '#eff1f5'
        },
        shellArgs: ['--login'],
        bell: 'SOUND',
        copyOnSelect: false,
        hyperTabs: {
            trafficButtons: true,
            activityColor: '#bf616a',
        }
    },
    plugins: [
        'hyper-search',
        'hyper-tabs-enhanced',
        'hypercwd',
        'hyperlayout',
        'hyperterm-bold-tab',
        'hyperterm-hidemenu',
        'hyperterm-tabs',
        'hyper-quit'
    ]
}
