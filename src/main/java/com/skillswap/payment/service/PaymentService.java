package com.skillswap.payment.service;

import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.skillswap.payment.dto.PaymentOrderRequest;
import com.skillswap.payment.dto.PaymentVerificationRequest;
import com.skillswap.payment.entity.Payment;
import com.skillswap.payment.repository.PaymentRepository;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

@Service
public class PaymentService {

    @Autowired
    private RazorpayClient razorpayClient;

    @Autowired
    private PaymentRepository paymentRepository;

    @Value("${razorpay.key.secret}")
    private String keySecret;

    @Value("${nodejs.api.url:http://localhost:5000}")
    private String nodejsApiUrl;

    private double fetchPremiumPrice() {
        try {
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(nodejsApiUrl + "/api/payments/premium-price"))
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            String body = response.body();
            // Parse premiumPrice from JSON: {"success":true,"price":{"premiumPrice":20,...}}
            int idx = body.indexOf("\"premiumPrice\":");
            if (idx != -1) {
                String sub = body.substring(idx + 15).trim();
                String numStr = sub.split("[^0-9.]")[0];
                return Double.parseDouble(numStr);
            }
        } catch (Exception e) {
            System.err.println("[PaymentService] Could not fetch premium price from Node.js: " + e.getMessage());
        }
        return 49.0; // fallback default
    }

    public Map<String, Object> createOrder(PaymentOrderRequest request) throws RazorpayException {
        // Check maximum payment limit
        int successfulPayments = paymentRepository.countByUserIdAndStatus(request.getUserId(), "SUCCESS");
        if (successfulPayments >= 2) {
            throw new RuntimeException("Maximum payment limit reached.");
        }

        // Use amount sent from frontend (already fetched from Node.js /api/payments/premium-price)
        double amount = (request.getAmount() != null && request.getAmount() > 0)
                ? request.getAmount()
                : 49.0;

        JSONObject orderRequest = new JSONObject();
        orderRequest.put("amount", (int)(amount * 100)); // amount in smallest currency unit (paise)
        orderRequest.put("currency", "INR");
        orderRequest.put("receipt", "txn_" + System.currentTimeMillis());

        Order order = razorpayClient.orders.create(orderRequest);

        Map<String, Object> response = new HashMap<>();
        response.put("orderId", order.get("id"));
        response.put("amount", amount);
        response.put("currency", order.get("currency"));

        return response;
    }

    public String verifyPayment(PaymentVerificationRequest request) {
        try {
            String payload = request.getRazorpayOrderId() + "|" + request.getRazorpayPaymentId();
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(keySecret.getBytes(), "HmacSHA256"));
            byte[] hexBytes = new org.apache.commons.codec.binary.Hex().encode(mac.doFinal(payload.getBytes()));
            String generatedSignature = new String(hexBytes);

            if (generatedSignature.equals(request.getRazorpaySignature())) {
                int count = paymentRepository.countByUserIdAndStatus(request.getUserId(), "SUCCESS");
                
                Payment payment = new Payment();
                payment.setUserId(request.getUserId());
                payment.setPaymentId(request.getRazorpayPaymentId());
                payment.setOrderId(request.getRazorpayOrderId());
                payment.setAmount(request.getAmount());
                payment.setStatus("SUCCESS");
                payment.setPaymentMethod("RAZORPAY");
                payment.setPaymentCount(count + 1);
                payment.setCreatedAt(LocalDateTime.now());
                
                paymentRepository.save(payment);
                
                return "SUCCESS";
            } else {
                return "FAILED";
            }
        } catch (Exception e) {
            e.printStackTrace();
            return "ERROR";
        }
    }
}
