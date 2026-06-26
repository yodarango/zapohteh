/*************************************************************************************************
* Every http response sent MUST conform to this pattern.
* ***********************************************************************************
 */

package models

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type HttpResponse struct {
	Error interface{} `json:"errors"`
	Data interface{} `json:"data"`
	Success bool 	`json:"success"`
}

func (h *HttpResponse) Send(w http.ResponseWriter){
	w.Header().Set("Content-Type", "application/json")

	err := json.NewEncoder(w).Encode(h)
	if err != nil {
		// Check if it's a broken pipe error (client disconnected)
		if strings.Contains(err.Error(), "broken pipe") {
			// This is normal when client disconnects early, just log at debug level
			fmt.Printf("client disconnected before response was fully sent: %v\n", err)
		} else {
			// For other encoding errors, log as an actual error
			fmt.Printf("error encoding response: %v\n", err)
		}
	}
}