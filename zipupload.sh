S3BucketName=$1

zip ./lambda/LambdaRpz.js.zip lambda/LambdaRpz.js -j

aws s3 cp ./layer/node-axios-layer.zip s3://$S3BucketName
aws s3 cp ./lambda/LambdaRpz.js.zip s3://$S3BucketName