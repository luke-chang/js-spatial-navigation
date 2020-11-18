export declare namespace SpatialNavigation {

    enum Direction {
        LEFT = 'left',
        RIGHT = 'right',
        UP = 'up',
        DOWN = 'down'
    }

    enum EnterTo {
        DEFAULT = '',
        LAST_FOCUSED = 'last-focused',
        DEFAULT_ELEMENT = 'default-element'
    }

    enum Restrict {
        SELF_FIRST = 'self-first',
        SELF_ONLY = 'self-only',
        NONE = 'none'
    }

    interface LeaveFor {
        left?: Selector | undefined,
        right?: Selector | undefined,
        up?: Selector | undefined,
        down?: Selector | undefined,
    }

    type Selector = string | Node | [Node] | NodeList

    interface Configuration {
        selector?: Selector | undefined
        straightOnly?: boolean | undefined
        straightOverlapThreshold?: number | undefined
        rememberSource?: boolean | undefined
        disabled?: boolean | undefined
        defaultElement?: Selector | undefined | ((sectionId: string, direction: Direction) => Selector | undefined)
        enterTo?: EnterTo | undefined,
        leaveFor?: LeaveFor | undefined,
        restrict?: Restrict | undefined,
        tabIndexIgnoreList?: string | undefined,
        navigableFilter?: (element: Node) => void | null | undefined
    }


    function init(): void

    function uninit(): void

    function clear(): void

    function add(config: Configuration)
    function add(sectionId: string, config: Configuration)

    function remove(sectionId: string)

    function set(config: Configuration)
    function set(sectionId: string, config: Configuration)

    function disable(sectionId: string)

    function enable(sectionId: string)

    function pause()

    function resume()

    function focus(sectionId?: string, silent?: boolean)
    function focus(selector?: Selector, silent?: boolean)

    function move(direction: Direction, selector?: Selector)

    function makeFocusable(sectionId?: string)

    function setDefaultSection(sectionId?: string)


}