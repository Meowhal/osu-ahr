"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotCommands = void 0;
// coded by https://autocode.com/tools/discord/command-builder/
exports.BotCommands = [
    {
        name: 'make',
        description: 'Make a tournament lobby',
        defaultPermission: false,
        options: [
            {
                type: 3,
                name: 'lobby_name',
                description: 'Initial lobby Name e.g. "4.00-5.99 auto host rotation"',
                required: true
            }
        ]
    },
    {
        name: 'enter',
        description: 'Enter the lobby.',
        defaultPermission: false,
        options: [
            {
                type: 4,
                name: 'lobby_id',
                description: ' Tournament lobby ID',
                required: false
            }
        ]
    },
    {
        name: 'info',
        description: 'Shows the status of the lobby.',
        defaultPermission: false,
        options: [
            {
                type: 4,
                name: 'lobby_id',
                description: ' Tournament lobby ID',
                required: false
            }
        ]
    },
    {
        name: 'say',
        description: 'send a message',
        defaultPermission: false,
        options: [
            {
                type: 3,
                name: 'message',
                description: 'message',
                required: true
            },
            {
                type: 4,
                name: 'lobby_id',
                description: ' Tournament lobby ID',
                required: false
            }
        ]
    },
    {
        name: 'config',
        description: 'configure ahrbot',
        defaultPermission: false,
        options: [
            {
                type: 3,
                name: 'section',
                description: 'specify config section',
                required: true
            },
            {
                type: 3,
                name: 'name',
                description: 'option name',
                required: true
            },
            {
                type: 3,
                name: 'value',
                description: 'new value',
                required: true
            }
        ]
    },
    {
        name: 'close',
        description: 'Close the lobby',
        defaultPermission: false,
        options: [
            {
                type: 4,
                name: 'lobby_id',
                description: ' Tournament lobby ID',
                required: false
            }
        ]
    },
    {
        name: 'quit',
        description: 'Quit managing the lobby',
        defaultPermission: false,
        options: [
            {
                type: 4,
                name: 'lobby_id',
                description: 'Tournament lobby ID',
                required: false
            }
        ]
    }
];
//# sourceMappingURL=BotCommand.js.map