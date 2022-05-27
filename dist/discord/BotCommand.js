"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotCommands = void 0;
// coded by https://autocode.com/tools/discord/command-builder/
exports.BotCommands = [
    {
        name: 'make',
        description: 'Make a tournament lobby.',
        defaultPermission: false,
        options: [
            {
                type: 3,
                name: 'lobby_name',
                description: 'The initial lobby name that\'ll be set, e.g., "4.00-5.99 auto host rotation"',
                required: true
            }
        ]
    },
    {
        name: 'enter',
        description: 'Enter a lobby.',
        defaultPermission: false,
        options: [
            {
                type: 4,
                name: 'lobby_id',
                description: 'The tournament lobby ID of the lobby to enter.',
                required: false
            }
        ]
    },
    {
        name: 'info',
        description: 'Show the status of a lobby.',
        defaultPermission: false,
        options: [
            {
                type: 4,
                name: 'lobby_id',
                description: 'The tournament lobby ID of the lobby to show it\'s status.',
                required: false
            }
        ]
    },
    {
        name: 'say',
        description: 'Send a message to a lobby.',
        defaultPermission: false,
        options: [
            {
                type: 3,
                name: 'message',
                description: 'The message to send.',
                required: true
            },
            {
                type: 4,
                name: 'lobby_id',
                description: 'The tournament lobby ID of a lobby to send a message to.',
                required: false
            }
        ]
    },
    {
        name: 'config',
        description: 'Configure the auto host rotation bot.',
        defaultPermission: false,
        options: [
            {
                type: 3,
                name: 'section',
                description: 'The configuration section to edit.',
                required: true
            },
            {
                type: 3,
                name: 'name',
                description: 'The configuration name to edit.',
                required: true
            },
            {
                type: 3,
                name: 'value',
                description: 'The new configuration value to set.',
                required: true
            }
        ]
    },
    {
        name: 'close',
        description: 'Close a lobby.',
        defaultPermission: false,
        options: [
            {
                type: 4,
                name: 'lobby_id',
                description: 'The tournament lobby ID of a lobby to close.',
                required: false
            }
        ]
    },
    {
        name: 'quit',
        description: 'Quit managing a lobby.',
        defaultPermission: false,
        options: [
            {
                type: 4,
                name: 'lobby_id',
                description: 'The tournament lobby ID of a lobby to quit managing.',
                required: false
            }
        ]
    }
];
//# sourceMappingURL=BotCommand.js.map