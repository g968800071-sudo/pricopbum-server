#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>

// Two trusted fingers, held together. Points are screen points from XCUICoordinate.
void pbInjectTwoSticks(CGPoint moveDown, CGPoint moveTo, CGPoint aimDown, CGPoint aimTo, NSTimeInterval hold, void (^_Nullable done)(NSString *_Nullable err));
