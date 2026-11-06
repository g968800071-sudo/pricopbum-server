#import "TouchInject.h"
#import <objc/message.h>

static id pbCallInit(Class cls, NSString *name, CGPoint point, NSTimeInterval offset) {
    SEL sel = NSSelectorFromString(name);
    if (![cls instancesRespondToSelector:sel]) return nil;
    return ((id (*)(id, SEL, CGPoint, NSTimeInterval))objc_msgSend)([cls alloc], sel, point, offset);
}

void pbInjectTwoSticks(CGPoint moveDown, CGPoint moveTo, CGPoint aimDown, CGPoint aimTo, NSTimeInterval hold, void (^done)(NSString *err)) {
    if (!done) done = ^(NSString *e) { (void)e; };
    Class pathCls = NSClassFromString(@"XCPointerEventPath");
    Class recCls = NSClassFromString(@"XCSynthesizedEventRecord");
    Class genCls = NSClassFromString(@"XCEventGenerator");
    if (!pathCls || !recCls || !genCls) { done(@"missing-xc-event"); return; }
    id move = pbCallInit(pathCls, @"initForTouchAtPoint:offset:", moveDown, 0);
    id aim = pbCallInit(pathCls, @"initForTouchAtPoint:offset:", aimDown, 0);
    if (!move || !aim) { done(@"no-initForTouchAtPoint"); return; }
    SEL moveSel = NSSelectorFromString(@"moveToPoint:atOffset:");
    SEL liftSel = NSSelectorFromString(@"liftUpAtOffset:");
    if (![move respondsToSelector:moveSel] || ![move respondsToSelector:liftSel]) { done(@"no-move-or-lift"); return; }
    NSTimeInterval up = 0.35 + (hold > 0.2 ? hold : 0.2);
    void (*moveFn)(id, SEL, CGPoint, NSTimeInterval) = (void (*)(id, SEL, CGPoint, NSTimeInterval))objc_msgSend;
    void (*liftFn)(id, SEL, NSTimeInterval) = (void (*)(id, SEL, NSTimeInterval))objc_msgSend;
    moveFn(move, moveSel, moveTo, 0.35);
    moveFn(aim, moveSel, aimTo, 0.35);
    liftFn(move, liftSel, up);
    liftFn(aim, liftSel, up);
    id record = nil;
    SEL named = NSSelectorFromString(@"initWithName:interfaceOrientation:");
    if ([recCls instancesRespondToSelector:named]) {
        record = ((id (*)(id, SEL, id, NSInteger))objc_msgSend)([recCls alloc], named, @"pb-sticks", (NSInteger)3);
    }
    if (!record) {
        SEL namedOnly = NSSelectorFromString(@"initWithName:");
        if ([recCls instancesRespondToSelector:namedOnly]) record = ((id (*)(id, SEL, id))objc_msgSend)([recCls alloc], namedOnly, @"pb-sticks");
    }
    if (!record) { done(@"no-event-record"); return; }
    SEL add = NSSelectorFromString(@"addPointerEventPath:");
    if (![record respondsToSelector:add]) { done(@"no-addPointerEventPath"); return; }
    ((void (*)(id, SEL, id))objc_msgSend)(record, add, move);
    ((void (*)(id, SEL, id))objc_msgSend)(record, add, aim);
    id gen = nil;
    SEL shared = NSSelectorFromString(@"sharedGenerator");
    if ([genCls respondsToSelector:shared]) gen = ((id (*)(id, SEL))objc_msgSend)(genCls, shared);
    SEL synth = NSSelectorFromString(@"synthesizeEvent:completion:");
    if (!gen || ![gen respondsToSelector:synth]) { done(@"no-synthesizeEvent"); return; }
    ((void (*)(id, SEL, id, void (^)(NSError *)))objc_msgSend)(gen, synth, record, ^(NSError *error) {
        done(error ? error.localizedDescription : nil);
    });
}
