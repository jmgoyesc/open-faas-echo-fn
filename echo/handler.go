package function

import (
	"fmt"
)

// Handle a serverless request
//
//goland:noinspection GoUnusedExportedFunction
func Handle(req []byte) string {
	return fmt.Sprintf("Hello, GitHub Actions v18. You said: %s", string(req))
}
