import { error } from "console"

global.console.log = jest.fn(); // console.log are ignored in tests