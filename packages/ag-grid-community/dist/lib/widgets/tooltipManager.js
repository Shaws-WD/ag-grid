"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
var context_1 = require("../context/context");
var popupService_1 = require("./popupService");
var componentRecipes_1 = require("../components/framework/componentRecipes");
var columnApi_1 = require("../columnController/columnApi");
var gridApi_1 = require("../gridApi");
var utils_1 = require("../utils");
var TooltipManager = /** @class */ (function () {
    function TooltipManager() {
        this.DEFAULT_HIDE_TOOLTIP_TIMEOUT = 10000;
        this.MOUSEOUT_HIDE_TOOLTIP_TIMEOUT = 1000;
        this.MOUSEOVER_SHOW_TOOLTIP_TIMEOUT = 2000;
        this.HIDE_SHOW_ONLY = true;
        this.showTimeoutId = 0;
        this.hideTimeoutId = 0;
        // map of compId to [tooltip component, close function]
        this.registeredComponents = {};
    }
    TooltipManager.prototype.registerTooltip = function (targetCmp) {
        var _this = this;
        var el = targetCmp.getGui();
        var id = targetCmp.getCompId();
        targetCmp.addDestroyableEventListener(el, 'mouseover', function (e) { return _this.processMouseOver(e, targetCmp); });
        targetCmp.addDestroyableEventListener(el, 'mousemove', function (e) { return _this.processMouseMove(e); });
        targetCmp.addDestroyableEventListener(el, 'mousedown', this.hideTooltip.bind(this));
        targetCmp.addDestroyableEventListener(el, 'mouseout', this.processMouseOut.bind(this));
        this.registeredComponents[id] = { tooltipComp: undefined, destroyFunc: undefined };
        targetCmp.addDestroyFunc(function () { return _this.unregisterTooltip(targetCmp); });
    };
    TooltipManager.prototype.unregisterTooltip = function (targetCmp) {
        var id = targetCmp.getCompId();
        // hide the tooltip if it's being displayed while unregistering the component
        if (this.activeComponent === targetCmp) {
            this.hideTooltip();
        }
        delete this.registeredComponents[id];
    };
    TooltipManager.prototype.processMouseOver = function (e, targetCmp) {
        var delay = this.MOUSEOVER_SHOW_TOOLTIP_TIMEOUT;
        if (this.activeComponent) {
            // lastHoveredComponent will be the activeComponent when we are hovering
            // a component with many child elements like the grid header
            if (this.lastHoveredComponent === this.activeComponent) {
                return;
            }
            delay = 200;
        }
        this.clearTimers(this.HIDE_SHOW_ONLY);
        // lastHoveredComponent will be the targetCmp when a click hid the tooltip
        // and the lastHoveredComponent has many child elements
        if (this.lastHoveredComponent === targetCmp) {
            return;
        }
        this.lastHoveredComponent = targetCmp;
        this.showTimeoutId = window.setTimeout(this.showTooltip.bind(this), delay, e);
    };
    TooltipManager.prototype.processMouseOut = function (e) {
        var activeComponent = this.activeComponent;
        var relatedTarget = e.relatedTarget;
        if (!activeComponent) {
            // when a click hides the tooltip we need to reset the lastHoveredComponent
            // otherwise the tooltip won't appear until another registered component is hovered.
            if (this.lastHoveredComponent && !this.lastHoveredComponent.getGui().contains(relatedTarget)) {
                this.lastHoveredComponent = undefined;
            }
            this.clearTimers();
            return;
        }
        // the mouseout was called from within the activeComponent so we do nothing
        if (activeComponent.getGui().contains(relatedTarget)) {
            return;
        }
        var registeredComponent = this.registeredComponents[activeComponent.getCompId()];
        utils_1._.addCssClass(registeredComponent.tooltipComp.getGui(), 'ag-tooltip-hiding');
        this.lastHoveredComponent = undefined;
        this.clearTimers();
        this.hideTimeoutId = window.setTimeout(this.hideTooltip.bind(this), this.MOUSEOUT_HIDE_TOOLTIP_TIMEOUT);
    };
    TooltipManager.prototype.processMouseMove = function (e) {
        // there is a delay from the time we mouseOver a component and the time the
        // tooltip is displayed, so we need to track mousemove to be able to correctly
        // position the tootip when showTooltip is called.
        this.lastMouseEvent = e;
    };
    TooltipManager.prototype.showTooltip = function (e) {
        var targetCmp = this.lastHoveredComponent;
        var cell = targetCmp;
        var registeredComponent = this.registeredComponents[targetCmp.getCompId()];
        this.hideTooltip();
        var params = {
            colDef: targetCmp.getComponentHolder(),
            rowIndex: cell.getGridCell && cell.getGridCell().rowIndex,
            column: cell.getColumn && cell.getColumn(),
            api: this.gridApi,
            columnApi: this.columnApi,
            value: targetCmp.getTooltipText()
        };
        this.createTooltipComponent(params, registeredComponent, e);
        this.activeComponent = this.lastHoveredComponent;
        this.hideTimeoutId = window.setTimeout(this.hideTooltip.bind(this), this.DEFAULT_HIDE_TOOLTIP_TIMEOUT);
    };
    TooltipManager.prototype.createTooltipComponent = function (params, cmp, e) {
        var _this = this;
        this.componentRecipes.newTooltipComponent(params).then(function (tooltipComp) {
            cmp.tooltipComp = tooltipComp;
            var eGui = tooltipComp.getGui();
            var closeFnc = _this.popupService.addPopup(false, eGui, false);
            cmp.destroyFunc = function () {
                closeFnc();
                if (tooltipComp.destroy) {
                    tooltipComp.destroy();
                }
            };
            _this.popupService.positionPopupUnderMouseEvent({
                type: 'tooltip',
                mouseEvent: _this.lastMouseEvent,
                ePopup: eGui,
                nudgeY: 18
            });
        });
    };
    TooltipManager.prototype.hideTooltip = function () {
        var activeComponent = this.activeComponent;
        this.clearTimers();
        if (!activeComponent) {
            return;
        }
        var id = activeComponent.getCompId();
        var registeredComponent = this.registeredComponents[id];
        this.activeComponent = undefined;
        if (!registeredComponent) {
            return;
        }
        if (registeredComponent.destroyFunc) {
            registeredComponent.destroyFunc();
        }
        this.clearRegisteredComponent(registeredComponent);
    };
    TooltipManager.prototype.clearRegisteredComponent = function (registeredComponent) {
        delete registeredComponent.destroyFunc;
        delete registeredComponent.tooltipComp;
    };
    TooltipManager.prototype.clearTimers = function (showOnly) {
        if (showOnly === void 0) { showOnly = false; }
        if (this.hideTimeoutId && !showOnly) {
            window.clearTimeout(this.hideTimeoutId);
            this.hideTimeoutId = 0;
        }
        if (this.showTimeoutId) {
            window.clearTimeout(this.showTimeoutId);
            this.showTimeoutId = 0;
        }
    };
    __decorate([
        context_1.Autowired('popupService'),
        __metadata("design:type", popupService_1.PopupService)
    ], TooltipManager.prototype, "popupService", void 0);
    __decorate([
        context_1.Autowired('componentRecipes'),
        __metadata("design:type", componentRecipes_1.ComponentRecipes)
    ], TooltipManager.prototype, "componentRecipes", void 0);
    __decorate([
        context_1.Autowired('columnApi'),
        __metadata("design:type", columnApi_1.ColumnApi)
    ], TooltipManager.prototype, "columnApi", void 0);
    __decorate([
        context_1.Autowired('gridApi'),
        __metadata("design:type", gridApi_1.GridApi)
    ], TooltipManager.prototype, "gridApi", void 0);
    TooltipManager = __decorate([
        context_1.Bean('tooltipManager')
    ], TooltipManager);
    return TooltipManager;
}());
exports.TooltipManager = TooltipManager;